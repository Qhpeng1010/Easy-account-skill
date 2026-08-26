#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const runtime = readFileSync(resolve(root, 'modules/easy-account/execution/renderer/page-spec-runtime.js'), 'utf8');
const css = readFileSync(resolve(root, 'modules/easy-account/execution/renderer/page-spec-business.css'), 'utf8');
const spec = JSON.parse(readFileSync(resolve(root, 'changes/20260826-account-query/page-spec.json'), 'utf8'));

assert.match(runtime, /function actionVisible\(action, row\)/);
assert.match(runtime, /action\.type === 'confirm-status'/);
assert.match(runtime, /confirmForm\.submit\(\)/);
assert.match(runtime, /lastOperationReason: values\.reason/);
assert.match(runtime, /action\.type === 'export' \? exportRows\(action\)/);
assert.match(runtime, /field\.control === 'date-range'/);
assert.match(css, /\.ea-confirm-action-modal \.ant-modal-content\s*\{[^}]*border-radius:\s*12px/s);

const table = spec.list.table;
const actionColumn = table.columns.find((column) => column.key === 'actions');
const freeze = actionColumn.actions.find((action) => action.key === 'freeze');
const unfreeze = actionColumn.actions.find((action) => action.key === 'unfreeze');
assert.equal(table.toolbarActions.some((action) => action.type === 'export'), true);
assert.deepEqual(freeze.visibleWhen, { field: 'accountStatus', value: 'normal' });
assert.deepEqual(unfreeze.visibleWhen, { field: 'accountStatus', value: 'frozen' });
assert.equal(freeze.confirm.reasonMinLength, 5);
assert.equal(unfreeze.confirm.reasonMinLength, 5);
assert.equal(table.columns.filter((column) => column.format === 'amount').length, 3);
assert.equal(table.columns.find((column) => column.key === 'accountStatus').format, 'status');
assert.equal(table.rows.every((row) => row.accountNo.includes('****')), true);
assert.equal(spec.states.loading && spec.states.empty && spec.states.error && spec.states.permissionDenied, true);

console.log('easy-account-list-actions: pass');
