#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  conditionMatches,
  fieldIsRequired,
  fieldIsVisible,
  resolveFieldOptions,
  validateFormFields
} from './lib/easy-account-form-fields.mjs';
import { validatePageSpec } from './lib/easy-account-page-spec.mjs';

const root = process.cwd();
const fields = [
  {
    key: 'feeType',
    label: '费用类型',
    control: 'radio',
    options: [
      { label: '营业收入收费', value: 'revenue' },
      { label: '固定金额收费', value: 'fixed' }
    ]
  },
  {
    key: 'ruleType',
    label: '分账规则',
    control: 'radio',
    optionsBy: {
      field: 'feeType',
      map: {
        revenue: [{ label: '比例', value: 'ratio' }],
        fixed: [{ label: '金额', value: 'amount' }, { label: '固定日期固定金额', value: 'fixed-date-amount' }]
      }
    }
  },
  {
    key: 'chargeDates',
    label: '扣费日期',
    control: 'select',
    mode: 'multiple',
    visibleWhen: { field: 'ruleType', value: 'fixed-date-amount' },
    requiredWhen: { field: 'ruleType', value: 'fixed-date-amount' },
    options: Array.from({ length: 28 }, (_, index) => ({ label: `${index + 1}日`, value: index + 1 }))
  },
  {
    key: 'brandRecipient',
    label: '品牌和收款方',
    control: 'cascader',
    options: [{ label: '品牌A', value: 'brand-a', children: [{ label: '收款方A', value: 'recipient-a' }] }]
  },
  { key: 'extension', label: '扩展组件', component: 'ColorPicker', props: { showText: true } }
];

assert.deepEqual(validateFormFields(fields), []);
assert.deepEqual(resolveFieldOptions(fields[1], { feeType: 'revenue' }).map((item) => item.value), ['ratio']);
assert.deepEqual(resolveFieldOptions(fields[1], { feeType: 'fixed' }).map((item) => item.value), ['amount', 'fixed-date-amount']);
assert.equal(fieldIsVisible(fields[2], { ruleType: 'amount' }), false);
assert.equal(fieldIsVisible(fields[2], { ruleType: 'fixed-date-amount' }), true);
assert.equal(fieldIsRequired(fields[2], { ruleType: 'fixed-date-amount' }), true);
assert.equal(conditionMatches({ any: [{ field: 'feeType', value: 'revenue' }, { field: 'storeScope', value: 'specified' }] }, { storeScope: 'specified' }), true);
assert.equal(conditionMatches({ field: 'platforms', operator: 'includesAny', values: ['wx', 'alipay'] }, { platforms: ['wx'] }), true);
assert.match(validateFormFields([{ key: 'bad', label: '错误组件', control: 'unknown-control' }]).join('\n'), /declare the Ant Design component name/);

const legacy = JSON.parse(readFileSync(resolve(root, 'changes/20260901-bank-card-information/page-spec.json'), 'utf8'));
legacy.list.table.primaryAction.form.fields = Array.from({ length: 8 }, (_, index) => ({ key: `field${index}`, label: `字段${index}`, control: 'input' }));
assert.match(validatePageSpec(legacy, root).errors.join('\n'), /expected drawer/);
legacy.list.table.primaryAction.preserveStructure = true;
assert.equal(validatePageSpec(legacy, root).valid, true);

const pageRuntime = readFileSync(resolve(root, 'modules/easy-account/execution/renderer/page-spec-runtime.js'), 'utf8');
const compositionRuntime = readFileSync(resolve(root, 'modules/easy-account/execution/renderer/page-composition-runtime.js'), 'utf8');
for (const runtime of [pageRuntime, compositionRuntime]) {
  assert.match(runtime, /mode: field\.mode \|\| \(field\.multiple \? 'multiple' : common\.mode\)/);
  assert.match(runtime, /function conditionMatches\(/);
  assert.match(runtime, /function normalizeDependentFields\(/);
  assert.match(runtime, /function renderField\(/);
  assert.match(runtime, /field\.optionsBy/);
  assert.match(runtime, /field\.component/);
}

console.log('easy-account-form-fields: pass');
