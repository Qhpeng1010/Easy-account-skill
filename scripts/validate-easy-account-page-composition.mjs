#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { validateCompositionFile } from './lib/easy-account-page-composition.mjs';

const args = process.argv.slice(2);
const sourceArg = args.find((arg) => arg.endsWith('.json'));
const shouldWrite = args.includes('--write');
if (!sourceArg) {
  console.error('Usage: node scripts/validate-easy-account-page-composition.mjs changes/{change-id}/page-composition.json [--write]');
  process.exit(2);
}

try {
  const root = process.cwd();
  const source = resolve(root, sourceArg);
  const result = validateCompositionFile(source, root);
  const payload = { schemaVersion: 1, system: 'easy-account', source: relative(root, source), ...result };
  if (shouldWrite) writeFileSync(resolve(dirname(source), 'composition-validation.json'), `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(`easy-account-page-composition-validation: failed\n- ${error.message}`);
  process.exitCode = 1;
}
