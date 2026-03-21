#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.cwd(), 'app/(public)/episodes/[slug]/page.tsx');
const source = fs.readFileSync(filePath, 'utf8');

const metadataReturnMatch = source.match(/return\s*{[\s\S]*?twitter:\s*{[\s\S]*?}\s*};/);
if (!metadataReturnMatch) {
  console.error('FAIL: Could not find generateMetadata return block in episode page.');
  process.exit(1);
}

const metadataBlock = metadataReturnMatch[0];
const titleAbsoluteMatch = metadataBlock.match(/title:\s*{\s*absolute:\s*([^}\n]+)\s*}/);
if (!titleAbsoluteMatch) {
  console.error('FAIL: Episode metadata title is not using `title.absolute`.');
  process.exit(1);
}

const absoluteExpr = titleAbsoluteMatch[1].trim();
if (absoluteExpr.includes('| The Compendium Podcast')) {
  console.error('FAIL: Episode metadata absolute title includes forbidden suffix `| The Compendium Podcast`.');
  process.exit(1);
}

console.log('PASS: Episode metadata title uses `title.absolute` without forbidden suffix.');
