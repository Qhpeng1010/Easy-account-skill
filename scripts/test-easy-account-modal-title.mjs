#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validatePageSpec } from './lib/easy-account-page-spec.mjs';

const root = process.cwd();
const readJson = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

const role = readJson('changes/20260824-role-management/page-spec.json');
assert.equal(validatePageSpec(role, root).valid, true);

const missingPrimaryTitle = structuredClone(role);
delete missingPrimaryTitle.list.table.primaryAction.form.title;
const missingPrimaryResult = validatePageSpec(missingPrimaryTitle, root);
assert.equal(missingPrimaryResult.valid, false);
assert.match(missingPrimaryResult.errors.join('\n'), /primaryAction\.form\.title is required/);

const store = readJson('changes/20260824-store-management/page-spec.json');
const missingRowTitle = structuredClone(store);
const editAction = missingRowTitle.list.table.columns.flatMap((column) => column.actions || []).find((action) => action.type === 'edit');
delete editAction.form.title;
const missingRowResult = validatePageSpec(missingRowTitle, root);
assert.equal(missingRowResult.valid, false);
assert.match(missingRowResult.errors.join('\n'), /edit action 1\.form\.title is required/);

const runtime = readFileSync(resolve(root, 'modules/easy-account/execution/renderer/page-spec-runtime.js'), 'utf8');
assert.match(runtime, /modalFormConfig\?\.title \|\| rowModalAction\?\.label \|\| primaryAction\?\.label \|\| '操作'/);
assert.match(runtime, /title: modalTitle/);

const schema = readJson('modules/easy-account/execution/page-spec.schema.json');
assert.deepEqual(schema.properties.list.properties.table.properties.primaryAction.allOf[0].then.properties.form.required, ['title']);

const temp = mkdtempSync(resolve(root, 'changes/.modal-title-test-'));
try {
  const changeId = '20260826-missing-modal-title';
  const changeDir = join(temp, changeId);
  mkdirSync(changeDir, { recursive: true });
  missingPrimaryTitle.metadata.changeId = changeId;
  writeFileSync(join(changeDir, 'page-spec.json'), `${JSON.stringify(missingPrimaryTitle, null, 2)}\n`);
  writeFileSync(join(changeDir, 'rules-read.md'), '# Rules Read\n');
  const build = spawnSync(process.execPath, ['scripts/build-easy-account-page-spec.mjs', join(changeDir, 'page-spec.json')], { cwd: root, encoding: 'utf8' });
  assert.equal(build.status, 1);
  assert.match(build.stderr, /primaryAction\.form\.title is required/);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('easy-account-modal-title: pass');
