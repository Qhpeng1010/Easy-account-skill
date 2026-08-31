#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolvePageStrategy } from './lib/easy-account-capability-policy.mjs';

const root = process.cwd();

const simple = resolvePageStrategy('做一个账户查询列表，支持新增和查看详情', root);
assert.equal(simple.strategy, 'legacy-adapter');
assert.equal(simple.family, 'list');
assert.equal(simple.templateId, 'list.account-query');

const summary = resolvePageStrategy('做一个账户查询、查询结果汇总和明细列表页面', root);
assert.equal(summary.strategy, 'composition');
assert.equal(summary.recipeId, 'query-summary-table');
assert.equal(summary.availability, 'available');

const overview = resolvePageStrategy('做一个账户查询、当前账户总览和明细列表页面', root);
assert.equal(overview.strategy, 'composition');
assert.equal(overview.recipeId, 'query-overview-table');
assert.equal(overview.availability, 'available');

const currentAccountList = resolvePageStrategy('查询当前账户的流水记录', root);
assert.equal(currentAccountList.strategy, 'legacy-adapter');

const combined = resolvePageStrategy('做一个账户查询，展示当前账户总览、查询结果汇总和明细列表', root);
assert.equal(combined.strategy, 'composition');
assert.equal(combined.recipeId, 'query-overview-summary-table');

const workflow = resolvePageStrategy('从查询列表进入分账步骤页，提交后进入分账结果页', root);
assert.equal(workflow.strategy, 'composition');
assert.equal(workflow.recipeId, 'list-open-tab-workflow');
assert.equal(workflow.skeleton, 'query-workbench');

const splitList = resolvePageStrategy('做一个分账列表页面', root);
assert.equal(splitList.strategy, 'legacy-adapter');
assert.equal(splitList.family, 'list');

const submit = resolvePageStrategy('提交全量商户信息并展示提交成功页', root);
assert.equal(submit.strategy, 'composition');
assert.equal(submit.recipeId, 'submission-review-result');

console.log('easy-account-capability-policy: pass');
