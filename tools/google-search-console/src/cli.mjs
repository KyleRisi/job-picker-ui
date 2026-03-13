import { runAuthenticateCommand } from './commands/authenticate.mjs';
import { runListPropertiesCommand } from './commands/list-properties.mjs';
import { runQuerySearchAnalyticsCommand } from './commands/query-search-analytics.mjs';
import { runInspectSiteReadinessCommand } from './commands/inspect-site-readiness.mjs';

function parseFlags(rawArgs) {
  const flags = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const withoutPrefix = arg.slice(2);
    if (withoutPrefix.includes('=')) {
      const [key, value] = withoutPrefix.split('=');
      flags[key] = value;
      continue;
    }

    const nextArg = rawArgs[index + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      flags[withoutPrefix] = nextArg;
      index += 1;
    } else {
      flags[withoutPrefix] = true;
    }
  }

  return flags;
}

function printHelp() {
  console.log('Google Search Console local CLI');
  console.log('');
  console.log('Commands:');
  console.log('  authenticate');
  console.log('  list-properties');
  console.log('  query-search-analytics --property <url> --start-date YYYY-MM-DD --end-date YYYY-MM-DD [--dimensions query,page] [--row-limit 25]');
  console.log('  inspect-site-readiness --property <url>');
}

async function main() {
  const [, , command, ...rawArgs] = process.argv;
  const flags = parseFlags(rawArgs);

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  if (command === 'authenticate') {
    await runAuthenticateCommand();
    return;
  }

  if (command === 'list-properties') {
    await runListPropertiesCommand();
    return;
  }

  if (command === 'query-search-analytics') {
    await runQuerySearchAnalyticsCommand(flags);
    return;
  }

  if (command === 'inspect-site-readiness') {
    await runInspectSiteReadinessCommand(flags);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error('');
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
