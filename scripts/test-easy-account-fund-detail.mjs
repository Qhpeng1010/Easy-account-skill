#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePageComposition } from './lib/easy-account-page-composition.mjs';

const root = process.cwd();
const file = resolve(root, 'changes/20260826-account-fund-detail/page-composition.json');
const spec = JSON.parse(readFileSync(file, 'utf8'));
const runtime = readFileSync(resolve(root, 'modules/easy-account/execution/renderer/page-composition-runtime.js'), 'utf8');
const result = validatePageComposition(spec, root);

assert.equal(result.valid, true);
assert.equal(result.readiness, 'preview-ready');
assert.equal(result.unsupportedRuntime.length, 0);
assert.equal(spec.recipeId, 'query-overview-table');
assert.equal(spec.regions.find((item) => item.type === 'overview').config.selectorKey, 'accountId');
assert.equal(Object.keys(spec.regions.find((item) => item.type === 'overview').config.metricsBySelector).length, 3);
assert.equal(spec.regions.find((item) => item.type === 'table').config.columns.filter((column) => column.format === 'amount').length, 5);
assert.equal(spec.regions.find((item) => item.type === 'action').config.actions.some((item) => item.type === 'export'), true);
assert.equal(spec.transitions.some((item) => item.id === 'row-to-detail-drawer' && item.presentation === 'drawer'), true);
assert.equal(spec.regions.find((item) => item.type === 'table').config.rows.every((row) => row.accountId), true);
assert.match(runtime, /metricsBySelector/);
assert.match(runtime, /item\.type === 'export'/);
assert.match(runtime, /setFilters\(values\)/);

console.log('easy-account-fund-detail: pass');
