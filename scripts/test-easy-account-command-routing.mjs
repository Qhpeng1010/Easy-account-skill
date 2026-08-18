#!/usr/bin/env node
import assert from 'node:assert/strict';
import { dispatch } from './dispatch-easy-account-command.mjs';
import { parseEasyAccountCommand, readCommandContract } from './lib/easy-account-command.mjs';

const root = process.cwd();
const contract = readCommandContract(root);

for (const mode of ['prd', 'design', 'full', 'fast']) {
  const parsed = parseEasyAccountCommand(`/easy-account:${mode} 生成账户查询列表`, contract);
  assert.equal(parsed.status, 'resolved');
  assert.equal(parsed.explicitCommand, true);
  assert.equal(parsed.mode, mode);
  assert.equal(parsed.request, '生成账户查询列表');
}

const natural = dispatch('生成易账通账户查询列表', root);
assert.equal(natural.status, 'natural-generation');
assert.equal(natural.mode, 'natural');
assert.equal(natural.explicitCommand, false);
assert.equal(natural.workflow.behavior, 'existing-default');
assert.deepEqual(natural.workflow.stages.map((stage) => stage.id), ['requirement', 'design', 'template', 'generate', 'review']);
assert.equal(natural.workflow.stages.find((stage) => stage.id === 'generate').scaffoldCommand, 'node scripts/scaffold-easy-account-page-spec.mjs changes/{change-id}');
assert.equal(natural.workflow.stages.find((stage) => stage.id === 'generate').buildCommand, 'node scripts/build-easy-account-page-spec.mjs changes/{change-id}/page-spec.json');
assert.equal(Object.hasOwn(natural.workflow, 'workflowRules'), false);
assert.deepEqual(
  natural.workflow.stages.find((stage) => stage.id === 'generate').resources.filter((resource) => resource.includes('context-packs/')),
  ['modules/easy-account/execution/context-packs/core.md', 'modules/easy-account/execution/context-packs/list.md']
);
assert.equal(natural.workflow.stages.find((stage) => stage.id === 'template').resources.some((resource) => resource.includes('/capability-model/')), false);

const embeddedSlash = parseEasyAccountCommand('查询备注中包含 /easy-account:fast 的记录', contract);
assert.equal(embeddedSlash.mode, 'natural');
assert.equal(embeddedSlash.explicitCommand, false);

const unknown = parseEasyAccountCommand('/easy-account:unknown 生成页面', contract);
assert.equal(unknown.status, 'unknown-command');
assert.deepEqual(unknown.supportedCommands, contract.commands.map((command) => command.token));

const missingBody = parseEasyAccountCommand('/easy-account:prd', contract);
assert.equal(missingBody.status, 'clarify');
assert.equal(missingBody.mode, 'prd');

const ordinarySlash = parseEasyAccountCommand('/account/query 页面说明', contract);
assert.equal(ordinarySlash.mode, 'natural');
assert.equal(ordinarySlash.explicitCommand, false);

const prd = dispatch('/easy-account:prd 做一个账户查询需求', root);
assert.equal(prd.status, 'mode-selected');
assert.equal(prd.implementationStatus, 'available');
assert.equal(prd.contract.primaryOutput, 'requirement.md');
assert.equal(prd.contract.resources[0], 'modules/easy-account/product/prd-standard.md');
assert.equal(prd.workflow.mode, 'prd');
assert.deepEqual(prd.workflow.requiredOutputs, ['requirement.md']);

const design = dispatch('/easy-account:design 设计账户查询页面', root);
assert.equal(design.status, 'mode-selected');
assert.equal(design.implementationStatus, 'available');
assert.equal(design.workflow.mode, 'design');
assert.equal(design.workflow.conditionalOutputs.unavailable[0], 'capability-gap.md');
assert.equal(design.workflow.route.family, 'list');
assert.deepEqual(
  design.workflow.stages.find((stage) => stage.id === 'preview-if-available').resources.filter((resource) => resource.includes('context-packs/')),
  ['modules/easy-account/execution/context-packs/core.md', 'modules/easy-account/execution/context-packs/list.md']
);

const full = dispatch('/easy-account:full 完整生成账户查询页面', root);
assert.equal(full.status, 'mode-selected');
assert.equal(full.implementationStatus, 'available');
assert.equal(full.workflow.mode, 'full');
assert.ok(full.workflow.requiredOutputs.includes('review.md'));
assert.equal(full.workflow.route.availability, 'available');

const listWithCreate = dispatch('/easy-account:design 设计账户查询列表，并支持新增账户', root);
assert.equal(listWithCreate.workflow.route.family, 'list');

const compositionRoute = dispatch('/easy-account:design 设计查询列表进入分账步骤页，提交后进入分账结果页', root);
assert.equal(compositionRoute.workflow.route.strategy, 'composition');
assert.equal(compositionRoute.workflow.route.recipeId, 'list-open-tab-workflow');
assert.equal(compositionRoute.workflow.stages.find((stage) => stage.id === 'preview-if-available').editableOutputs[0], 'page-composition.json');
assert.match(compositionRoute.workflow.stages.find((stage) => stage.id === 'preview-if-available').buildCommand, /build-easy-account-page-composition/);
assert.equal(compositionRoute.workflow.stages.find((stage) => stage.id === 'design').resources.some((resource) => resource.includes('/capability-model/')), true);

const drawerCreate = dispatch('/easy-account:design 设计账户抽屉新增页面', root);
assert.equal(drawerCreate.workflow.route.id, 'drawer-form');

const fast = dispatch('/easy-account:fast 做一个账户查询列表', root);
assert.equal(fast.status, 'mode-selected');
assert.equal(fast.contract.fallbackMode, 'natural');
assert.equal(fast.implementationStatus, 'contract-only');
assert.equal(Object.hasOwn(fast, 'workflow'), false);

console.log('easy-account-command-routing: pass');
