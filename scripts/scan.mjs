#!/usr/bin/env node
/** One-off CLI scan: `npm run scan`. Useful for cron/scheduled indexing. */
import { initDatabase, closeDatabase } from '../src/database/index.js';
import { runScan } from '../src/indexer/scanner.js';
import { config } from '../src/config.js';

initDatabase();

console.log(`Scanning ${config.libraryPath} …`);
const result = await runScan({ reason: 'cli', force: process.argv.includes('--force') });

console.log(
  [
    `status:  ${result.status}`,
    `scanned: ${result.scanned}/${result.total}`,
    `added:   ${result.added}`,
    `updated: ${result.updated}`,
    `removed: ${result.removed}`,
    `errors:  ${result.errors}`,
  ].join('\n'),
);

closeDatabase();
process.exit(result.status === 'error' ? 1 : 0);
