#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const STRATEGIES = ['mobile', 'desktop'];

function parseArgs(argv) {
  const out = {
    url: '',
    outDir: 'docs/reports'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--url') {
      out.url = `${argv[index + 1] || ''}`.trim();
      index += 1;
      continue;
    }
    if (token === '--out-dir') {
      out.outDir = `${argv[index + 1] || ''}`.trim() || out.outDir;
      index += 1;
    }
  }

  return out;
}

function readNumberEnv(name) {
  const raw = `${process.env[name] || ''}`.trim();
  if (!raw) return { ok: false, reason: 'missing', value: null };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return { ok: false, reason: 'invalid', value: null };
  return { ok: true, reason: '', value: parsed };
}

function requireGateConfig() {
  const required = {
    HOMEPAGE_V2_LIGHTHOUSE_PERFORMANCE_MIN: readNumberEnv('HOMEPAGE_V2_LIGHTHOUSE_PERFORMANCE_MIN'),
    HOMEPAGE_V2_LIGHTHOUSE_ACCESSIBILITY_MIN: readNumberEnv('HOMEPAGE_V2_LIGHTHOUSE_ACCESSIBILITY_MIN'),
    HOMEPAGE_V2_LIGHTHOUSE_BEST_PRACTICES_MIN: readNumberEnv('HOMEPAGE_V2_LIGHTHOUSE_BEST_PRACTICES_MIN'),
    HOMEPAGE_V2_LIGHTHOUSE_SEO_MIN: readNumberEnv('HOMEPAGE_V2_LIGHTHOUSE_SEO_MIN'),
    HOMEPAGE_V2_CWV_LCP_MS_MAX: readNumberEnv('HOMEPAGE_V2_CWV_LCP_MS_MAX'),
    HOMEPAGE_V2_CWV_CLS_MAX: readNumberEnv('HOMEPAGE_V2_CWV_CLS_MAX'),
    HOMEPAGE_V2_CWV_INP_MS_MAX: readNumberEnv('HOMEPAGE_V2_CWV_INP_MS_MAX'),
    HOMEPAGE_V2_BUDGET_TOTAL_BYTES: readNumberEnv('HOMEPAGE_V2_BUDGET_TOTAL_BYTES'),
    HOMEPAGE_V2_BUDGET_JS_BYTES: readNumberEnv('HOMEPAGE_V2_BUDGET_JS_BYTES'),
    HOMEPAGE_V2_BUDGET_IMAGE_BYTES: readNumberEnv('HOMEPAGE_V2_BUDGET_IMAGE_BYTES'),
    HOMEPAGE_V2_BUDGET_REQUEST_COUNT: readNumberEnv('HOMEPAGE_V2_BUDGET_REQUEST_COUNT'),
    HOMEPAGE_V2_LEANER_MAX_RATIO: readNumberEnv('HOMEPAGE_V2_LEANER_MAX_RATIO')
  };

  const missing = Object.entries(required)
    .filter(([, state]) => !state.ok)
    .map(([name, state]) => `${name} (${state.reason})`);

  if (missing.length) {
    throw new Error(
      'Launch gate requires explicit numeric thresholds. Missing/invalid: ' + missing.join(', ')
    );
  }

  return {
    lighthouse: {
      performanceMin: required.HOMEPAGE_V2_LIGHTHOUSE_PERFORMANCE_MIN.value,
      accessibilityMin: required.HOMEPAGE_V2_LIGHTHOUSE_ACCESSIBILITY_MIN.value,
      bestPracticesMin: required.HOMEPAGE_V2_LIGHTHOUSE_BEST_PRACTICES_MIN.value,
      seoMin: required.HOMEPAGE_V2_LIGHTHOUSE_SEO_MIN.value
    },
    cwv: {
      lcpMax: required.HOMEPAGE_V2_CWV_LCP_MS_MAX.value,
      clsMax: required.HOMEPAGE_V2_CWV_CLS_MAX.value,
      inpMax: required.HOMEPAGE_V2_CWV_INP_MS_MAX.value
    },
    budget: {
      totalBytesMax: required.HOMEPAGE_V2_BUDGET_TOTAL_BYTES.value,
      jsBytesMax: required.HOMEPAGE_V2_BUDGET_JS_BYTES.value,
      imageBytesMax: required.HOMEPAGE_V2_BUDGET_IMAGE_BYTES.value,
      requestCountMax: required.HOMEPAGE_V2_BUDGET_REQUEST_COUNT.value
    },
    leanerMaxRatio: required.HOMEPAGE_V2_LEANER_MAX_RATIO.value
  };
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function toScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNetworkPayload(audits) {
  const items = audits?.['network-requests']?.details?.items;
  if (!Array.isArray(items)) {
    return {
      totalTransferredBytes: null,
      jsTransferredBytes: null,
      imageTransferredBytes: null,
      requestCount: null
    };
  }

  let totalTransferredBytes = 0;
  let jsTransferredBytes = 0;
  let imageTransferredBytes = 0;

  for (const item of items) {
    const transferSize = Number(item?.transferSize) || 0;
    const resourceType = `${item?.resourceType || ''}`;

    totalTransferredBytes += transferSize;
    if (resourceType === 'Script') jsTransferredBytes += transferSize;
    if (resourceType === 'Image') imageTransferredBytes += transferSize;
  }

  return {
    totalTransferredBytes,
    jsTransferredBytes,
    imageTransferredBytes,
    requestCount: items.length
  };
}

function extractMetrics(psiPayload) {
  const lighthouseResult = psiPayload?.lighthouseResult || {};
  const categories = lighthouseResult?.categories || {};
  const audits = lighthouseResult?.audits || {};

  const payload = parseNetworkPayload(audits);

  return {
    scores: {
      performance: toScore(categories?.performance?.score),
      accessibility: toScore(categories?.accessibility?.score),
      bestPractices: toScore(categories?.['best-practices']?.score),
      seo: toScore(categories?.seo?.score)
    },
    cwv: {
      lcpMs: toNumber(audits?.['largest-contentful-paint']?.numericValue),
      cls: toNumber(audits?.['cumulative-layout-shift']?.numericValue),
      inpMs:
        toNumber(audits?.['interaction-to-next-paint']?.numericValue)
        ?? toNumber(audits?.['experimental-interaction-to-next-paint']?.numericValue)
        ?? toNumber(audits?.['max-potential-fid']?.numericValue)
    },
    payload,
    fetchTime: `${psiPayload?.analysisUTCTimestamp || ''}`
  };
}

async function runPsiAudit(url, strategy) {
  const params = new URLSearchParams();
  params.set('url', url);
  params.set('strategy', strategy);
  params.append('category', 'performance');
  params.append('category', 'accessibility');
  params.append('category', 'best-practices');
  params.append('category', 'seo');

  const apiKey = `${process.env.PAGESPEED_API_KEY || ''}`.trim();
  if (apiKey) params.set('key', apiKey);

  const requestUrl = `${PSI_ENDPOINT}?${params.toString()}`;

  const response = await fetch(requestUrl, { method: 'GET' });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`PageSpeed failed for ${strategy} ${url}: HTTP ${response.status} ${body}`);
  }

  const json = await response.json();
  return extractMetrics(json);
}

function buildOverallPayload(metricsByStrategy) {
  const values = Object.values(metricsByStrategy).filter(Boolean);
  const maxValue = (selector) => {
    const numbers = values
      .map(selector)
      .filter((value) => Number.isFinite(value));
    if (!numbers.length) return null;
    return Math.max(...numbers);
  };

  return {
    totalTransferredBytes: maxValue((metrics) => metrics.payload.totalTransferredBytes),
    jsTransferredBytes: maxValue((metrics) => metrics.payload.jsTransferredBytes),
    imageTransferredBytes: maxValue((metrics) => metrics.payload.imageTransferredBytes),
    requestCount: maxValue((metrics) => metrics.payload.requestCount)
  };
}

function evaluateStrategy(config, strategy, homepageMetrics, baselineMetrics) {
  const failures = [];

  if ((homepageMetrics.scores.performance ?? -1) < config.lighthouse.performanceMin) {
    failures.push(`${strategy}: performance ${homepageMetrics.scores.performance ?? 'n/a'} < ${config.lighthouse.performanceMin}`);
  }
  if ((homepageMetrics.scores.accessibility ?? -1) < config.lighthouse.accessibilityMin) {
    failures.push(`${strategy}: accessibility ${homepageMetrics.scores.accessibility ?? 'n/a'} < ${config.lighthouse.accessibilityMin}`);
  }
  if ((homepageMetrics.scores.bestPractices ?? -1) < config.lighthouse.bestPracticesMin) {
    failures.push(`${strategy}: best_practices ${homepageMetrics.scores.bestPractices ?? 'n/a'} < ${config.lighthouse.bestPracticesMin}`);
  }
  if ((homepageMetrics.scores.seo ?? -1) < config.lighthouse.seoMin) {
    failures.push(`${strategy}: seo ${homepageMetrics.scores.seo ?? 'n/a'} < ${config.lighthouse.seoMin}`);
  }

  if ((homepageMetrics.cwv.lcpMs ?? Number.POSITIVE_INFINITY) > config.cwv.lcpMax) {
    failures.push(`${strategy}: LCP ${homepageMetrics.cwv.lcpMs ?? 'n/a'}ms > ${config.cwv.lcpMax}ms`);
  }
  if ((homepageMetrics.cwv.cls ?? Number.POSITIVE_INFINITY) > config.cwv.clsMax) {
    failures.push(`${strategy}: CLS ${homepageMetrics.cwv.cls ?? 'n/a'} > ${config.cwv.clsMax}`);
  }
  if ((homepageMetrics.cwv.inpMs ?? Number.POSITIVE_INFINITY) > config.cwv.inpMax) {
    failures.push(`${strategy}: INP ${homepageMetrics.cwv.inpMs ?? 'n/a'}ms > ${config.cwv.inpMax}ms`);
  }

  if ((homepageMetrics.payload.totalTransferredBytes ?? Number.POSITIVE_INFINITY) > config.budget.totalBytesMax) {
    failures.push(`${strategy}: total bytes ${homepageMetrics.payload.totalTransferredBytes ?? 'n/a'} > ${config.budget.totalBytesMax}`);
  }
  if ((homepageMetrics.payload.jsTransferredBytes ?? Number.POSITIVE_INFINITY) > config.budget.jsBytesMax) {
    failures.push(`${strategy}: JS bytes ${homepageMetrics.payload.jsTransferredBytes ?? 'n/a'} > ${config.budget.jsBytesMax}`);
  }
  if ((homepageMetrics.payload.imageTransferredBytes ?? Number.POSITIVE_INFINITY) > config.budget.imageBytesMax) {
    failures.push(`${strategy}: image bytes ${homepageMetrics.payload.imageTransferredBytes ?? 'n/a'} > ${config.budget.imageBytesMax}`);
  }
  if ((homepageMetrics.payload.requestCount ?? Number.POSITIVE_INFINITY) > config.budget.requestCountMax) {
    failures.push(`${strategy}: requests ${homepageMetrics.payload.requestCount ?? 'n/a'} > ${config.budget.requestCountMax}`);
  }

  const homepageBytes = homepageMetrics.payload.totalTransferredBytes;
  const baselineBytes = baselineMetrics.payload.totalTransferredBytes;

  if (Number.isFinite(homepageBytes) && Number.isFinite(baselineBytes) && baselineBytes > 0) {
    const ratio = homepageBytes / baselineBytes;
    if (ratio > config.leanerMaxRatio) {
      failures.push(
        `${strategy}: homepage/true-crime ratio ${(ratio * 100).toFixed(1)}% exceeds max ${(config.leanerMaxRatio * 100).toFixed(1)}%`
      );
    }
  } else {
    failures.push(`${strategy}: unable to compute homepage vs true-crime payload ratio.`);
  }

  return failures;
}

function markdownTableRows(metricsByStrategy) {
  return STRATEGIES.map((strategy) => {
    const metrics = metricsByStrategy[strategy];
    return `| ${strategy} | ${metrics.scores.performance ?? 'n/a'} | ${metrics.scores.accessibility ?? 'n/a'} | ${metrics.scores.bestPractices ?? 'n/a'} | ${metrics.scores.seo ?? 'n/a'} | ${metrics.cwv.lcpMs ?? 'n/a'} | ${metrics.cwv.cls ?? 'n/a'} | ${metrics.cwv.inpMs ?? 'n/a'} | ${formatBytes(metrics.payload.totalTransferredBytes)} | ${formatBytes(metrics.payload.jsTransferredBytes)} | ${formatBytes(metrics.payload.imageTransferredBytes)} | ${metrics.payload.requestCount ?? 'n/a'} |`;
  }).join('\n');
}

function markdownPayloadBlock(title, payload) {
  return [
    `- ${title} total transferred size: ${formatBytes(payload.totalTransferredBytes)}`,
    `- ${title} JS transferred size: ${formatBytes(payload.jsTransferredBytes)}`,
    `- ${title} image transferred size: ${formatBytes(payload.imageTransferredBytes)}`,
    `- ${title} total request count: ${payload.requestCount ?? 'n/a'}`
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = requireGateConfig();

  const homepageUrl = args.url || `${process.env.HOMEPAGE_V2_PREVIEW_URL || ''}`.trim();
  if (!homepageUrl) {
    throw new Error('Missing preview URL. Pass --url <preview-homepage-v2-url> or set HOMEPAGE_V2_PREVIEW_URL.');
  }

  const homepageUrlObject = new URL(homepageUrl);
  const trueCrimeUrl = new URL('/topics/true-crime', homepageUrlObject.origin).toString();

  const homepageMetricsByStrategy = {};
  const trueCrimeMetricsByStrategy = {};

  for (const strategy of STRATEGIES) {
    homepageMetricsByStrategy[strategy] = await runPsiAudit(homepageUrl, strategy);
    trueCrimeMetricsByStrategy[strategy] = await runPsiAudit(trueCrimeUrl, strategy);
  }

  const failures = [];
  for (const strategy of STRATEGIES) {
    failures.push(
      ...evaluateStrategy(
        config,
        strategy,
        homepageMetricsByStrategy[strategy],
        trueCrimeMetricsByStrategy[strategy]
      )
    );
  }

  const homepageOverallPayload = buildOverallPayload(homepageMetricsByStrategy);
  const trueCrimeOverallPayload = buildOverallPayload(trueCrimeMetricsByStrategy);

  const report = {
    generatedAt: new Date().toISOString(),
    homepageUrl,
    comparisonUrl: trueCrimeUrl,
    thresholds: config,
    homepage: {
      strategies: homepageMetricsByStrategy,
      overall: homepageOverallPayload
    },
    trueCrimeTopicHub: {
      strategies: trueCrimeMetricsByStrategy,
      overall: trueCrimeOverallPayload
    },
    pass: failures.length === 0,
    failures
  };

  const markdown = [
    '# Homepage V2 Launch Gate Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Preview URL: ${homepageUrl}`,
    `Comparison URL: ${trueCrimeUrl}`,
    `Gate result: ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Homepage V2 (Per Strategy)',
    '| Strategy | Perf | A11y | Best Practices | SEO | LCP (ms) | CLS | INP (ms) | Total Transfer | JS Transfer | Image Transfer | Requests |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    markdownTableRows(homepageMetricsByStrategy),
    '',
    '## True-Crime Hub Baseline (Per Strategy)',
    '| Strategy | Perf | A11y | Best Practices | SEO | LCP (ms) | CLS | INP (ms) | Total Transfer | JS Transfer | Image Transfer | Requests |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    markdownTableRows(trueCrimeMetricsByStrategy),
    '',
    '## Required Report Metrics (Overall Worst-Case)',
    markdownPayloadBlock('Homepage V2', homepageOverallPayload),
    markdownPayloadBlock('True-crime hub', trueCrimeOverallPayload),
    '',
    '## Failures',
    ...(failures.length ? failures.map((failure) => `- ${failure}`) : ['- None'])
  ].join('\n');

  await fs.mkdir(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, 'homepage-v2-launch-gate.json');
  const mdPath = path.join(args.outDir, 'homepage-v2-launch-gate.md');

  await Promise.all([
    fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8'),
    fs.writeFile(mdPath, markdown, 'utf8')
  ]);

  console.log(`Homepage V2 launch gate ${report.pass ? 'PASSED' : 'FAILED'}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);

  if (!report.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
