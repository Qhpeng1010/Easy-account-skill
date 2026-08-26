#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { validatePageComposition } from './lib/easy-account-page-composition.mjs';

const root = process.cwd();
const base = {
  schemaVersion: 2,
  metadata: {
    changeId: '20260818-composition-test',
    pageName: '账户汇总查询',
    ruleRefs: ['EA-TPL-001', 'EA-TPL-003', 'EA-TPL-004', 'EA-INT-002']
  },
  ui: { system: 'easy-account', runtime: 'easy-account-composition', rendererVersion: 1 },
  skeleton: 'query-workbench',
  recipeId: 'query-summary-table',
  regions: [
    { id: 'query', type: 'query', capabilities: ['query.basic'] },
    { id: 'summary', type: 'summary', capabilities: ['summary.metrics', 'summary.aggregate', 'binding.queryToSummary'] },
    { id: 'table', type: 'table', capabilities: ['table.flat', 'table.pagination'] }
  ],
  bindings: [
    {
      id: 'query-to-summary',
      from: { scope: 'query', path: 'filters' },
      to: { region: 'summary', path: 'metrics' },
      mode: 'filter',
      transform: 'aggregate'
    }
  ],
  transitions: []
};

const valid = validatePageComposition(base, root);
assert.equal(valid.valid, true);
assert.equal(valid.readiness, 'preview-ready');
assert.equal(valid.errors.length, 0);
assert.deepEqual(valid.unsupportedRuntime, []);

const compositionRuntime = readFileSync(join(root, 'modules/easy-account/execution/renderer/page-composition-runtime.js'), 'utf8');
const compositionCss = readFileSync(join(root, 'modules/easy-account/execution/renderer/page-composition-business.css'), 'utf8');
const templateRules = readFileSync(join(root, 'modules/easy-account/director-rules/02-template-application-rules.md'), 'utf8');
const componentRules = readFileSync(join(root, 'modules/easy-account/components.md'), 'utf8');
const visualRules = readFileSync(join(root, 'modules/easy-account/director-rules/01-visual-constitution.md'), 'utf8');
const interactionRules = readFileSync(join(root, 'modules/easy-account/director-rules/03-interaction-acceptance-rules.md'), 'utf8');
const listContext = readFileSync(join(root, 'modules/easy-account/execution/context-packs/list.md'), 'utf8');
const pageSpecCss = readFileSync(join(root, 'modules/easy-account/execution/renderer/page-spec-business.css'), 'utf8');
const pageSpecRuntime = readFileSync(join(root, 'modules/easy-account/execution/renderer/page-spec-runtime.js'), 'utf8');
const shellCss = readFileSync(join(root, 'modules/easy-account/shell/shell.css'), 'utf8');
const shellContentCss = readFileSync(join(root, 'modules/easy-account/shell/content-base.css'), 'utf8');
const tabsPosition = compositionRuntime.indexOf("className: 'ea-composition-query-tabs'");
const selectorPosition = compositionRuntime.indexOf("className: `ea-composition-query-selector-grid");
const summaryPosition = compositionRuntime.indexOf("className: 'ea-composition-query-summary'");
const queryGridPosition = compositionRuntime.indexOf("className: 'ea-composition-query-grid'");
const tablePosition = compositionRuntime.indexOf("className: 'ea-composition-module ea-composition-table'");
assert.ok(tabsPosition >= 0 && tabsPosition < selectorPosition && selectorPosition < summaryPosition && summaryPosition < queryGridPosition && queryGridPosition < tablePosition);
assert.match(compositionRuntime, /\bStatistic\b/);
assert.match(compositionRuntime, /function statisticTitle\(metric\)/);
assert.match(compositionRuntime, /title:\s*statisticTitle\(metric\)/);
assert.match(compositionRuntime, /metrics\.map\(statistic\)/);
assert.match(compositionRuntime, /const summaryTabKeys = summary\?\.config\?\.visibleTabKeys/);
assert.match(compositionRuntime, /const summaryVisible = Boolean\(summary && \(!summaryTabKeys\?\.length \|\| summaryTabKeys\.includes\(activeTab\)\)\)/);
assert.match(compositionRuntime, /config\.queryTitle && !combinedOverview/);
assert.match(compositionRuntime, /const combinedOverview = Boolean\(selectorFields\.length && summaryVisible\)/);
assert.match(compositionRuntime, /combinedOverview \? ' ea-composition-query-selector-grid--overview' : ''/);
assert.match(compositionRuntime, /'--ea-overview-metric-count': Math\.max\(metrics\.length, 1\)/);
assert.match(compositionRuntime, /const managementConfig = summary\?\.config\?\.management/);
assert.match(compositionRuntime, /summaryVisible && summary\?\.capabilities\?\.includes\('summary\.manage'\) && managementConfig\?\.visible !== false/);
assert.match(compositionRuntime, /summaryVisible \? h\('section', \{ className: 'ea-composition-query-summary'/);
assert.match(compositionRuntime, /className: 'ea-composition-query-summary-heading'/);
assert.match(compositionRuntime, /management\.fields \|\| \[\]/);
assert.match(compositionRuntime, /message\.success\(management\?\.successMessage/);
assert.match(compositionRuntime, /type: management\.primary === false \? 'default' : 'primary'/);
assert.match(compositionRuntime, /token: \{ colorPrimary: '#1E75FF', borderRadius: 6 \}/);
assert.match(compositionRuntime, /Button: \{ borderRadius: 6 \}/);
assert.match(pageSpecRuntime, /token: \{ colorPrimary: '#1E75FF', borderRadius: 6 \}/);
assert.match(pageSpecRuntime, /Button: \{ borderRadius: 6 \}/);
assert.match(shellCss, /--ea-control-radius:\s*6px;/);
assert.match(shellContentCss, /\.ea-btn\s*\{[^}]*border-radius:\s*var\(--ea-control-radius\)/s);
assert.match(shellContentCss, /\.ea-input\s*\{[^}]*border-radius:\s*var\(--ea-control-radius\)/s);
assert.doesNotMatch(compositionRuntime, /suffix:\s*metric\.unit/);
assert.match(compositionRuntime, /showSizeChanger:\s*true/);
assert.match(compositionRuntime, /field\.control === 'date-range'/);
assert.match(compositionCss, /--ea-tabs-surface:\s*#fbfcfc;/);
assert.match(compositionCss, /\.ea-composition-query-tabs\s*>\s*\.ant-tabs-nav\s*\{[^}]*margin:\s*-16px -16px 16px[^}]*background:\s*var\(--ea-tabs-surface\)/s);
assert.match(compositionCss, /\.ea-composition-query-tabs\s*>\s*\.ant-tabs-nav\s*\{[^}]*border-bottom:\s*1px solid var\(--ea-table-border\)/s);
assert.match(compositionCss, /\.ea-composition-query-selector-grid--overview\s*\{[^}]*width:\s*calc\(100% \/ var\(--ea-overview-metric-count, 3\)\)/s);
assert.match(compositionCss, /\.ant-form\.ant-form-vertical \.ea-composition-query-selector-grid--overview \.ant-form-item-row\s*\{[^}]*flex-flow:\s*row nowrap[^}]*align-items:\s*center/s);
assert.match(compositionCss, /@media \(max-width:\s*767px\)[\s\S]*\.ea-composition-query-selector-grid--overview\s*\{[^}]*width:\s*100%[^}]*\}[\s\S]*\.ant-form\.ant-form-vertical \.ea-composition-query-selector-grid--overview \.ant-form-item-row\s*\{[^}]*flex-flow:\s*column nowrap/s);
assert.match(compositionCss, /\.ea-composition-query-summary\s*\{[^}]*margin:\s*32px 0 24px[^}]*padding:\s*0 0 20px/s);
assert.doesNotMatch(compositionCss.match(/\.ea-composition-query-summary\s*\{[^}]*\}/s)?.[0] || '', /border-bottom/);
assert.doesNotMatch(compositionCss.match(/\.ea-composition-query-summary\s*\{[^}]*\}/s)?.[0] || '', /border-top/);
assert.match(compositionCss, /\.ea-composition-query-summary-heading\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*margin-bottom:\s*16px/s);
assert.match(compositionCss, /\.ea-composition-query-summary-heading \.ant-btn\s*\{[^}]*height:\s*32px/s);
assert.match(compositionCss, /\.ea-composition-summary \.ant-statistic:first-child/);
assert.doesNotMatch(compositionCss.match(/\.ea-composition-summary \.ant-statistic\s*\{[^}]*\}/s)?.[0] || '', /border-left/);
assert.doesNotMatch(compositionCss.match(/@media \(max-width:\s*767px\)[\s\S]*?\.ea-composition-summary \.ant-statistic\s*\{[^}]*\}/s)?.[0] || '', /border-top/);
assert.match(pageSpecCss, /--ea-tabs-surface:\s*#fbfcfc;/);
assert.match(pageSpecCss, /\.ea-query-tabs\s*>\s*\.ant-tabs-nav\s*\{[^}]*background:\s*var\(--ea-tabs-surface\)/s);
assert.match(pageSpecCss, /\.ea-query-tabs\s*>\s*\.ant-tabs-nav\s*\{[^}]*border-bottom:\s*1px solid var\(--ea-table-border\)/s);
assert.match(templateRules, /主对象选择器、账户总览、查询条件/);
assert.match(templateRules, /Ant Design `Statistic`/);
assert.match(templateRules, /#FBFCFC/);
assert.match(templateRules, /`1px solid #E4E4E7`/);
assert.match(templateRules, /不再为查询条件额外渲染/);
assert.match(templateRules, /普通查询条件和不带可见账户总览的选择器继续使用标签在上、控件在下的纵向布局/);
assert.match(templateRules, /显式声明 `summary\.manage` 并提供管理配置后，默认/);
assert.match(templateRules, /字段、选项、校验、初始值、提交文案和成功反馈均由具体产品或业务 Page Spec 定义/);
assert.match(componentRules, /`Statistic`：全技能范围内/);
assert.match(visualRules, /所有以“标题 \+ 指标值”呈现的整体统计和对象概览项统一使用 Ant Design 官方 `Statistic`/);
assert.match(visualRules, /全局按钮和有外框的表单交互控件统一使用 `6px` 圆角/);
assert.match(interactionRules, /账户总览标题上方间距为 `32px`/);
assert.match(interactionRules, /仅组合中的主对象选择器采用标签在左、控件在右的横向布局/);
assert.match(interactionRules, /整体宽度与账户总览第一个 Statistic 指标列一致/);
assert.match(interactionRules, /显式声明 `summary\.manage` 的账户总览/);
assert.match(interactionRules, /默认使用 Primary/);
assert.match(interactionRules, /所有普通按钮与 Input、InputNumber、Select、DatePicker、RangePicker、Textarea、TreeSelect 和上传触发按钮均为 `6px` 圆角/);
assert.match(listContext, /exact surface color `#FBFCFC`/);
assert.match(listContext, /ordinary query fields and selectors without a visible account overview remain vertical/i);
assert.match(listContext, /do not add a gray divider below the overview/i);
assert.match(listContext, /`summary\.config\.visibleTabKeys`/);

const workflow = structuredClone(base);
workflow.metadata.pageId = 'account-list';
workflow.workflow = {
  pages: [{
    id: 'merchant-submit',
    label: '商户信息提交',
    skeleton: 'form-workflow',
    regions: [{ id: 'step-form', type: 'step-form', capabilities: ['form.steps', 'form.validation', 'binding.rowToForm'], config: { steps: [] } }],
    bindings: [],
    transitions: []
  }]
};
workflow.regions = [...base.regions, { id: 'action', type: 'action', capabilities: ['navigation.openTab'] }];
workflow.bindings = [{ id: 'row-to-form', from: { scope: 'row', path: 'merchantId' }, to: { pageId: 'merchant-submit', region: 'step-form', path: 'merchantId' }, mode: 'context' }];
workflow.transitions = [{ id: 'open-submit', event: 'openTab', to: 'merchant-submit', requires: ['navigation.openTab'], bindingIds: ['row-to-form'] }];
const workflowResult = validatePageComposition(workflow, root);
assert.equal(workflowResult.valid, true);
assert.equal(workflowResult.readiness, 'preview-ready');

const managedSummary = structuredClone(base);
managedSummary.regions[1].capabilities.push('summary.manage');
managedSummary.regions[1].config = { management: { label: '规则管理', fields: [{ key: 'name', label: '名称', control: 'input' }] } };
const managedSummaryResult = validatePageComposition(managedSummary, root);
assert.equal(managedSummaryResult.valid, true);
assert.equal(managedSummaryResult.readiness, 'preview-ready');

const hiddenManagedSummary = structuredClone(managedSummary);
hiddenManagedSummary.regions[1].config.management.visible = false;
const hiddenManagedSummaryResult = validatePageComposition(hiddenManagedSummary, root);
assert.equal(hiddenManagedSummaryResult.valid, true);

const invalidManagementVisibility = structuredClone(managedSummary);
invalidManagementVisibility.regions[1].config.management.visible = 'false';
const invalidManagementVisibilityResult = validatePageComposition(invalidManagementVisibility, root);
assert.equal(invalidManagementVisibilityResult.valid, false);
assert.match(invalidManagementVisibilityResult.errors.join('\n'), /management\.visible must be a boolean/);

const tabScopedSummary = structuredClone(managedSummary);
tabScopedSummary.regions[0].config = { tabs: [{ key: 'ordinary', label: '普通查询' }, { key: 'overview', label: '账户总览' }] };
tabScopedSummary.regions[1].config.visibleTabKeys = ['overview'];
const tabScopedSummaryResult = validatePageComposition(tabScopedSummary, root);
assert.equal(tabScopedSummaryResult.valid, true);

const emptyVisibleTabKeys = structuredClone(tabScopedSummary);
emptyVisibleTabKeys.regions[1].config.visibleTabKeys = [];
const emptyVisibleTabKeysResult = validatePageComposition(emptyVisibleTabKeys, root);
assert.equal(emptyVisibleTabKeysResult.valid, false);
assert.match(emptyVisibleTabKeysResult.errors.join('\n'), /must be a non-empty array of query Tab keys/);

const duplicateVisibleTabKeys = structuredClone(tabScopedSummary);
duplicateVisibleTabKeys.regions[1].config.visibleTabKeys = ['overview', 'overview'];
const duplicateVisibleTabKeysResult = validatePageComposition(duplicateVisibleTabKeys, root);
assert.equal(duplicateVisibleTabKeysResult.valid, false);
assert.match(duplicateVisibleTabKeysResult.errors.join('\n'), /must not contain duplicate Tab keys/);

const unknownVisibleTabKeys = structuredClone(tabScopedSummary);
unknownVisibleTabKeys.regions[1].config.visibleTabKeys = ['missing'];
const unknownVisibleTabKeysResult = validatePageComposition(unknownVisibleTabKeys, root);
assert.equal(unknownVisibleTabKeysResult.valid, false);
assert.match(unknownVisibleTabKeysResult.errors.join('\n'), /contains unknown query Tab keys: missing/);

const emptyManagedSummary = structuredClone(managedSummary);
emptyManagedSummary.regions[1].config.management.fields = [];
const emptyManagedSummaryResult = validatePageComposition(emptyManagedSummary, root);
assert.equal(emptyManagedSummaryResult.valid, false);
assert.match(emptyManagedSummaryResult.errors.join('\n'), /must contain 1 to 6 fields/);

const wrongOrder = structuredClone(base);
wrongOrder.regions = [base.regions[0], base.regions[2], base.regions[1]];
const wrongOrderResult = validatePageComposition(wrongOrder, root);
assert.equal(wrongOrderResult.valid, false);
assert.match(wrongOrderResult.errors.join('\n'), /region order/);

const wrongCapability = structuredClone(base);
wrongCapability.regions[2].capabilities.push('summary.metrics');
const wrongCapabilityResult = validatePageComposition(wrongCapability, root);
assert.equal(wrongCapabilityResult.valid, false);
assert.match(wrongCapabilityResult.errors.join('\n'), /belongs to summary/);

const unknownProperty = structuredClone(base);
unknownProperty.regions[0].unsafeRendererOverride = true;
const unknownPropertyResult = validatePageComposition(unknownProperty, root);
assert.equal(unknownPropertyResult.valid, false);
assert.match(unknownPropertyResult.errors.join('\n'), /unsupported properties/);

const missingBindingCapability = structuredClone(base);
missingBindingCapability.regions[1].capabilities = ['summary.metrics', 'summary.aggregate'];
const missingBindingResult = validatePageComposition(missingBindingCapability, root);
assert.equal(missingBindingResult.valid, false);
assert.match(missingBindingResult.errors.join('\n'), /binding.queryToSummary/);

const temp = mkdtempSync(join(tmpdir(), 'easy-account-composition-'));
try {
  const changeDir = join(temp, '20260818-composition-test');
  const scaffold = spawnSync(process.execPath, ['scripts/scaffold-easy-account-page-composition.mjs', changeDir], { cwd: root, encoding: 'utf8' });
  assert.equal(scaffold.status, 0, scaffold.stderr);
  const validation = spawnSync(process.execPath, ['scripts/validate-easy-account-page-composition.mjs', join(changeDir, 'page-composition.json'), '--write'], { cwd: root, encoding: 'utf8' });
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(existsSync(join(changeDir, 'composition-validation.json')), true);
  const output = JSON.parse(readFileSync(join(changeDir, 'composition-validation.json'), 'utf8'));
  assert.equal(output.valid, true);
  assert.equal(output.readiness, 'preview-ready');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('easy-account-page-composition: pass');
