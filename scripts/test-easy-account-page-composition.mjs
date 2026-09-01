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
    { id: 'summary', type: 'summary', capabilities: ['summary.metrics', 'summary.aggregate', 'binding.queryToSummary'], config: { metrics: [{ key: 'resultCount', label: '结果总数', aggregate: 'count' }] } },
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

const overriddenCollapseThreshold = structuredClone(base);
overriddenCollapseThreshold.regions[0].config = { collapseThreshold: 4 };
const overriddenCollapseThresholdResult = validatePageComposition(overriddenCollapseThreshold, root);
assert.equal(overriddenCollapseThresholdResult.valid, false);
assert.match(overriddenCollapseThresholdResult.errors.join('\n'), /collapseThreshold must match the fixed director rule value 3/);

const overviewBase = structuredClone(base);
overviewBase.metadata.pageName = '账户总览查询';
overviewBase.recipeId = 'query-overview-table';
overviewBase.regions = [
  { id: 'query', type: 'query', capabilities: ['query.basic'] },
  { id: 'overview', type: 'overview', capabilities: ['overview.metrics', 'binding.selectorToOverview'], config: { selectorKey: 'accountId', metrics: [{ key: 'balance', label: '账户余额', value: '100.00', unit: '元' }] } },
  { id: 'table', type: 'table', capabilities: ['table.flat', 'table.pagination'] }
];
overviewBase.bindings = [{ id: 'selector-to-overview', from: { scope: 'query', path: 'filters.accountId' }, to: { region: 'overview', path: 'metrics' }, mode: 'filter' }];
const overviewValid = validatePageComposition(overviewBase, root);
assert.equal(overviewValid.valid, true);
assert.equal(overviewValid.readiness, 'preview-ready');

const combinedBase = structuredClone(base);
combinedBase.metadata.pageName = '账户总览与结果汇总查询';
combinedBase.recipeId = 'query-overview-summary-table';
combinedBase.regions = [overviewBase.regions[0], overviewBase.regions[1], base.regions[1], base.regions[2]];
combinedBase.bindings = [overviewBase.bindings[0], base.bindings[0]];
const combinedValid = validatePageComposition(combinedBase, root);
assert.equal(combinedValid.valid, true);
assert.equal(combinedValid.readiness, 'preview-ready');

const fourMetricSummary = structuredClone(base);
fourMetricSummary.regions[1].config.metrics = Array.from({ length: 4 }, (_, index) => ({ key: `metric${index + 1}`, label: `指标${index + 1}`, aggregate: 'count', unit: '条' }));
const fourMetricSummaryValid = validatePageComposition(fourMetricSummary, root);
assert.equal(fourMetricSummaryValid.valid, true);
assert.equal(fourMetricSummaryValid.readiness, 'preview-ready');

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
const overviewPosition = compositionRuntime.indexOf("className: 'ea-composition-query-overview'");
const queryGridPosition = compositionRuntime.indexOf("className: 'ea-composition-query-grid'");
const summaryPosition = compositionRuntime.indexOf("className: 'ea-composition-query-result-summary'");
const tablePosition = compositionRuntime.indexOf("className: 'ea-composition-module ea-composition-table'");
assert.ok(tabsPosition >= 0 && tabsPosition < selectorPosition && selectorPosition < overviewPosition && overviewPosition < queryGridPosition && queryGridPosition < summaryPosition && summaryPosition < tablePosition);
assert.match(compositionRuntime, /\bStatistic\b/);
assert.match(compositionRuntime, /function statisticTitle\(metric\)/);
assert.match(compositionRuntime, /function inlineSummary\(metrics\)/);
assert.match(compositionRuntime, /title:\s*statisticTitle\(metric\)/);
assert.match(compositionRuntime, /overviewMetrics\.map\(statistic\)/);
assert.match(compositionRuntime, /summaryMetrics\.map\(statistic\)/);
assert.match(compositionRuntime, /className: 'ea-composition-statistics ea-composition-overview-statistics'/);
assert.match(compositionRuntime, /className: 'ea-composition-statistics ea-composition-summary-statistics'/);
assert.match(compositionRuntime, /const overviewTabKeys = overview\?\.config\?\.visibleTabKeys/);
assert.match(compositionRuntime, /const overviewVisible = Boolean\(overview && \(!overviewTabKeys\?\.length \|\| overviewTabKeys\.includes\(activeTab\)\)\)/);
assert.match(compositionRuntime, /const summaryTabKeys = summary\?\.config\?\.visibleTabKeys/);
assert.match(compositionRuntime, /const summaryVisible = Boolean\(summary && \(!summaryTabKeys\?\.length \|\| summaryTabKeys\.includes\(activeTab\)\)\)/);
assert.match(compositionRuntime, /config\.queryTitle && !combinedOverview/);
assert.match(compositionRuntime, /const combinedOverview = Boolean\(selectorFields\.length && overviewVisible\)/);
assert.match(compositionRuntime, /const collapseThreshold = page\.directorPolicy\?\.query\?\.collapseThreshold \|\| 3/);
assert.doesNotMatch(compositionRuntime, /const collapseThreshold = config\.collapseThreshold/);
assert.match(compositionRuntime, /combinedOverview \? ' ea-composition-query-selector-grid--overview' : ''/);
assert.match(compositionRuntime, /'--ea-overview-metric-count': Math\.max\(overviewMetrics\.length, 1\)/);
assert.match(compositionRuntime, /const managementConfig = overview\?\.config\?\.management/);
assert.match(compositionRuntime, /overviewVisible && overview\?\.capabilities\?\.includes\('overview\.manage'\) && managementConfig\?\.visible !== false/);
assert.match(compositionRuntime, /overviewVisible \? h\('section', \{ className: 'ea-composition-query-overview'/);
assert.match(compositionRuntime, /className: 'ea-composition-query-overview-heading'/);
assert.match(compositionRuntime, /const inlineSummaryVisible = summaryVisible && summaryMetrics\.length > 0 && summaryMetrics\.length <= 3/);
assert.match(compositionRuntime, /const cardSummaryVisible = summaryVisible && summaryMetrics\.length > 3/);
assert.match(compositionRuntime, /cardSummaryVisible \? h\('section', \{ className: 'ea-composition-query-result-summary'/);
assert.match(compositionRuntime, /inlineSummaryVisible \? inlineSummary\(summaryMetrics\) : h\('h2', null, tableConfig\.title \|\| '查询列表'\)/);
assert.match(compositionRuntime, /'查询汇总：'/);
assert.match(compositionRuntime, /'｜'/);
assert.doesNotMatch(compositionRuntime, /className: 'ea-composition-module ea-composition-query-result-summary'/);
assert.doesNotMatch(compositionRuntime, /h\('h2', null, summary\.config\?\.title \|\| '查询结果汇总'\)/);
assert.match(compositionRuntime, /management\.fields \|\| \[\]/);
assert.match(compositionRuntime, /message\.success\(management\?\.successMessage/);
assert.match(compositionRuntime, /type: management\.primary === false \? 'default' : 'primary'/);
assert.match(compositionRuntime, /token: \{ colorPrimary: '#1E75FF', borderRadius: 6 \}/);
assert.match(compositionRuntime, /Button: \{ borderRadius: 6 \}/);
assert.match(pageSpecRuntime, /token: \{ colorPrimary: '#1E75FF', borderRadius: 6 \}/);
assert.match(pageSpecRuntime, /Button: \{ borderRadius: 6 \}/);
assert.match(pageSpecRuntime, /const collapseThreshold = spec\.directorPolicy\?\.query\?\.collapseThreshold \|\| 3/);
assert.doesNotMatch(pageSpecRuntime, /const collapseThreshold = spec\.list\.query\.collapseThreshold/);
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
assert.match(compositionCss, /\.ea-composition-query-overview\s*\{[^}]*margin:\s*32px 0 24px[^}]*padding:\s*0 0 20px/s);
assert.match(compositionCss.match(/\.ea-composition-query-overview\s*\{[^}]*\}/s)?.[0] || '', /border-bottom:\s*1px solid #ededed/i);
assert.doesNotMatch(compositionCss.match(/\.ea-composition-query-overview\s*\{[^}]*\}/s)?.[0] || '', /border-top/);
assert.match(compositionCss, /\.ea-composition-query-overview-heading\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*margin-bottom:\s*16px/s);
assert.match(compositionCss, /\.ea-composition-query-overview-heading \.ant-btn\s*\{[^}]*height:\s*32px/s);
assert.match(compositionCss, /\.ea-composition-query-result-summary\s*\{[^}]*min-width:\s*0/s);
assert.doesNotMatch(compositionCss.match(/\.ea-composition-query-result-summary\s*\{[^}]*\}/s)?.[0] || '', /background|padding|border|border-radius/);
assert.match(compositionCss, /\.ea-composition-overview-statistics \.ant-statistic:first-child/);
assert.match(compositionCss, /\.ea-composition-overview-statistics \.ant-statistic \+ \.ant-statistic::before\s*\{[^}]*width:\s*1px[^}]*height:\s*16px[^}]*background-color:\s*#e4e4e7[^}]*opacity:\s*1/s);
assert.match(compositionCss, /@media \(max-width:\s*767px\)[\s\S]*\.ea-composition-overview-statistics \.ant-statistic \+ \.ant-statistic::before\s*\{[^}]*display:\s*none/s);
assert.match(compositionCss, /\.ea-composition-summary-statistics\s*\{[^}]*gap:\s*12px/s);
assert.match(compositionCss, /\.ea-composition-summary-statistics \.ant-statistic\s*\{[^}]*border-radius:\s*6px[^}]*background:\s*var\(--ea-page-white\)[^}]*padding:\s*16px/s);
assert.doesNotMatch(compositionCss.match(/\.ea-composition-summary-statistics \.ant-statistic\s*\{[^}]*\}/s)?.[0] || '', /\bborder\s*:/);
assert.match(compositionCss, /\.ea-composition-inline-summary\s*\{[^}]*font-size:\s*14px[^}]*line-height:\s*22px[^}]*letter-spacing:\s*0/s);
assert.match(compositionCss, /\.ea-composition-inline-summary-value\s*\{[^}]*color:\s*var\(--ea-page-brand\)/s);
assert.match(compositionCss, /\.ea-composition-inline-summary-separator\s*\{[^}]*color:\s*#e4e4e7/s);
assert.match(pageSpecCss, /--ea-tabs-surface:\s*#fbfcfc;/);
assert.match(pageSpecCss, /\.ea-query-tabs\s*>\s*\.ant-tabs-nav\s*\{[^}]*background:\s*var\(--ea-tabs-surface\)/s);
assert.match(pageSpecCss, /\.ea-query-tabs\s*>\s*\.ant-tabs-nav\s*\{[^}]*border-bottom:\s*1px solid var\(--ea-table-border\)/s);
assert.match(templateRules, /主对象选择器、对象总览、查询条件/);
assert.match(templateRules, /查询条件模块下方、结果 Table 上方/);
assert.match(templateRules, /Ant Design `Statistic`/);
assert.match(templateRules, /汇总指标为 1–3 条时，替换查询列表标题/);
assert.match(templateRules, /分隔符使用全角 `｜` 且颜色固定为 `#E4E4E7`/);
assert.match(templateRules, /汇总指标超过 3 条时/);
assert.match(templateRules, /使用 `6px` 圆角、白色背景且无边框、无阴影/);
assert.match(templateRules, /#FBFCFC/);
assert.match(templateRules, /`1px solid #E4E4E7`/);
assert.match(templateRules, /不再为查询条件额外渲染/);
assert.match(templateRules, /普通查询条件和不带可见对象总览的选择器继续使用标签在上、控件在下的纵向布局/);
assert.match(templateRules, /显式声明 `overview\.manage` 并提供管理配置后，默认/);
assert.match(templateRules, /字段、选项、校验、初始值、提交文案和成功反馈均由具体产品或业务 Page Spec 定义/);
assert.match(componentRules, /`Statistic`：账户余额/);
assert.match(componentRules, /1–3 条时用 `14px` 紧凑文字替换查询列表标题/);
assert.match(componentRules, /超过 3 条时位于查询条件模块下方、结果 Table 上方/);
assert.match(visualRules, /对象总览和超过 3 条的查询结果汇总统一使用 Ant Design 官方 `Statistic`/);
assert.match(visualRules, /仅 1–3 条查询结果汇总使用结果工具栏内的紧凑文字形态/);
assert.match(visualRules, /全局按钮和有外框的表单交互控件统一使用 `6px` 圆角/);
assert.match(interactionRules, /账户总览标题上方间距为 `32px`/);
assert.match(interactionRules, /仅组合中的主对象选择器采用标签在左、控件在右的横向布局/);
assert.match(interactionRules, /整体宽度与账户总览第一个 Statistic 指标列一致/);
assert.match(interactionRules, /显式声明 `overview\.manage` 的对象总览/);
assert.match(interactionRules, /1–3 条查询汇总替换查询列表标题/);
assert.match(interactionRules, /4 条以上汇总位于完整查询条件模块下方、结果 Table 上方/);
assert.match(interactionRules, /无边框、无阴影的独立白色统计卡片/);
assert.match(interactionRules, /默认使用 Primary/);
assert.match(interactionRules, /所有普通按钮与 Input、InputNumber、Select、DatePicker、RangePicker、Textarea、TreeSelect 和上传触发按钮均为 `6px` 圆角/);
assert.match(listContext, /exact surface color `#FBFCFC`/);
assert.match(listContext, /For one to three metrics, replace the result-table title/);
assert.match(listContext, /For more than three metrics, render an unframed row/);
assert.match(listContext, /no border, and no shadow/);
assert.match(listContext, /add one `1px solid #EDEDED` divider between the overview and the following query conditions/i);
assert.match(listContext, /`overview\.config\.visibleTabKeys`/);

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

const managedOverview = structuredClone(overviewBase);
managedOverview.regions[1].capabilities.push('overview.manage');
managedOverview.regions[1].config.management = { label: '规则管理', fields: [{ key: 'name', label: '名称', control: 'input' }] };
const managedOverviewResult = validatePageComposition(managedOverview, root);
assert.equal(managedOverviewResult.valid, true);
assert.equal(managedOverviewResult.readiness, 'preview-ready');

const hiddenManagedOverview = structuredClone(managedOverview);
hiddenManagedOverview.regions[1].config.management.visible = false;
const hiddenManagedOverviewResult = validatePageComposition(hiddenManagedOverview, root);
assert.equal(hiddenManagedOverviewResult.valid, true);

const invalidManagementVisibility = structuredClone(managedOverview);
invalidManagementVisibility.regions[1].config.management.visible = 'false';
const invalidManagementVisibilityResult = validatePageComposition(invalidManagementVisibility, root);
assert.equal(invalidManagementVisibilityResult.valid, false);
assert.match(invalidManagementVisibilityResult.errors.join('\n'), /management\.visible must be a boolean/);

const tabScopedOverview = structuredClone(managedOverview);
tabScopedOverview.regions[0].config = { tabs: [{ key: 'ordinary', label: '普通查询' }, { key: 'overview', label: '账户总览' }] };
tabScopedOverview.regions[1].config.visibleTabKeys = ['overview'];
const tabScopedOverviewResult = validatePageComposition(tabScopedOverview, root);
assert.equal(tabScopedOverviewResult.valid, true);

const emptyVisibleTabKeys = structuredClone(tabScopedOverview);
emptyVisibleTabKeys.regions[1].config.visibleTabKeys = [];
const emptyVisibleTabKeysResult = validatePageComposition(emptyVisibleTabKeys, root);
assert.equal(emptyVisibleTabKeysResult.valid, false);
assert.match(emptyVisibleTabKeysResult.errors.join('\n'), /must be a non-empty array of query Tab keys/);

const duplicateVisibleTabKeys = structuredClone(tabScopedOverview);
duplicateVisibleTabKeys.regions[1].config.visibleTabKeys = ['overview', 'overview'];
const duplicateVisibleTabKeysResult = validatePageComposition(duplicateVisibleTabKeys, root);
assert.equal(duplicateVisibleTabKeysResult.valid, false);
assert.match(duplicateVisibleTabKeysResult.errors.join('\n'), /must not contain duplicate Tab keys/);

const unknownVisibleTabKeys = structuredClone(tabScopedOverview);
unknownVisibleTabKeys.regions[1].config.visibleTabKeys = ['missing'];
const unknownVisibleTabKeysResult = validatePageComposition(unknownVisibleTabKeys, root);
assert.equal(unknownVisibleTabKeysResult.valid, false);
assert.match(unknownVisibleTabKeysResult.errors.join('\n'), /contains unknown query Tab keys: missing/);

const emptyManagedOverview = structuredClone(managedOverview);
emptyManagedOverview.regions[1].config.management.fields = [];
const emptyManagedOverviewResult = validatePageComposition(emptyManagedOverview, root);
assert.equal(emptyManagedOverviewResult.valid, false);
assert.match(emptyManagedOverviewResult.errors.join('\n'), /must contain at least 1 field/);

const extendedManagedOverview = structuredClone(managedOverview);
extendedManagedOverview.regions[1].config.management.fields = Array.from({ length: 8 }, (_, index) => ({ key: `field${index}`, label: `字段${index}`, control: 'input' }));
const unpreservedExtendedManagedOverviewResult = validatePageComposition(extendedManagedOverview, root);
assert.equal(unpreservedExtendedManagedOverviewResult.valid, false);
assert.match(unpreservedExtendedManagedOverviewResult.errors.join('\n'), /requires preserveStructure=true/);
extendedManagedOverview.regions[1].config.management.preserveStructure = true;
const extendedManagedOverviewResult = validatePageComposition(extendedManagedOverview, root);
assert.equal(extendedManagedOverviewResult.valid, true);

const summaryWithOverviewConfig = structuredClone(base);
summaryWithOverviewConfig.regions[1].config.selectorKey = 'accountId';
const summaryWithOverviewConfigResult = validatePageComposition(summaryWithOverviewConfig, root);
assert.equal(summaryWithOverviewConfigResult.valid, false);
assert.match(summaryWithOverviewConfigResult.errors.join('\n'), /summary config contains overview-only properties: selectorKey/);

const aggregatingOverview = structuredClone(overviewBase);
aggregatingOverview.regions[1].config.metrics[0].aggregate = 'sum';
const aggregatingOverviewResult = validatePageComposition(aggregatingOverview, root);
assert.equal(aggregatingOverviewResult.valid, false);
assert.match(aggregatingOverviewResult.errors.join('\n'), /overview metrics must not declare aggregate/);

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
