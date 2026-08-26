#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePageSpec } from './lib/easy-account-page-spec.mjs';

const root = process.cwd();
const spec = JSON.parse(readFileSync(resolve(root, 'changes/20260826-ledger-flow-query/page-spec.json'), 'utf8'));
const runtime = readFileSync(resolve(root, 'modules/easy-account/execution/renderer/page-spec-runtime.js'), 'utf8');
const result = validatePageSpec(spec, root);
const table = spec.list.table;

assert.equal(result.valid, true);
assert.equal(spec.content.capabilities.includes('query.advanced'), true);
assert.equal(spec.list.query.fields.length, 7);
assert.equal(table.views.length, 5);
assert.equal(table.views.some((view) => Array.isArray(view.queryFields)), false);
assert.equal(table.views.reduce((total, view) => view.key === 'all' ? total : total + view.count, 0), table.views.find((view) => view.key === 'all').count);
assert.equal(table.columns.filter((column) => column.format === 'amount').length, 3);
assert.equal(table.columns.find((column) => column.key === 'transactionStatus').format, 'status');
assert.equal(table.toolbarActions.some((action) => action.type === 'export'), true);
assert.equal(table.rows.every((row) => row.accountNo.includes('****')), true);
assert.match(runtime, /if \(queryTabs\) \{/);
assert.match(runtime, /setActiveView\(key\);\s*setPage\(1\);/s);

console.log('easy-account-ledger-flow-query: pass');
