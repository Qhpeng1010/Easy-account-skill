import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readDirectorRules } from './easy-account-director-rules.mjs';

const DOMAIN_PATH = 'modules/easy-account/domain.json';
const POLICY_PATH = 'modules/easy-account/execution/generation-policy.json';
const REGISTRY_PATH = 'modules/easy-account/execution/capability-model/capability-registry.json';
const RULES_PATH = 'modules/easy-account/execution/capability-model/composition-rules.json';

function readJson(root, file) {
  return JSON.parse(readFileSync(resolve(root, file), 'utf8'));
}

export function readCapabilityPolicy(root = process.cwd()) {
  return {
    domain: readJson(root, DOMAIN_PATH),
    legacy: readJson(root, POLICY_PATH),
    registry: readJson(root, REGISTRY_PATH),
    rules: readJson(root, RULES_PATH),
    director: readDirectorRules(root)
  };
}

function includesAny(request, signals) {
  return signals.some((signal) => request.includes(signal));
}

export function resolvePageStrategy(request, root = process.cwd()) {
  const source = String(request || '').trim();
  const model = readCapabilityPolicy(root);
  const hasQuery = includesAny(source, ['查询', '列表', '记录']);
  // A business noun such as “分账” does not imply a multi-page workflow by itself.
  // Require an explicit stage, result, review or tab transition signal before routing
  // to a composition recipe; this keeps ordinary split-account lists on the legacy path.
  const hasWorkflow = includesAny(source, ['步骤', '工作流', '复核', '新标签页', '结果页', '提交成功', '处理结果']);
  const hasGenericSummary = includesAny(source, ['统计', '汇总', '指标', '总数']);
  const hasOverview = includesAny(source, ['总览', '概览'])
    || (hasGenericSummary && includesAny(source, ['当前对象', '当前账户', '当前企业']));
  const hasResultSummary = includesAny(source, ['查询结果汇总', '查询结果统计', '结果汇总', '结果统计', '统计查询结果', '合计']);
  const hasForm = includesAny(source, ['表单', '新增', '新建', '编辑', '提交']);
  const recipe = hasQuery && hasWorkflow
    ? model.rules.recipes.find((item) => item.id === 'list-open-tab-workflow')
    : hasForm && hasWorkflow
      ? model.rules.recipes.find((item) => item.id === 'submission-review-result')
      : hasQuery && hasOverview && hasResultSummary
        ? model.rules.recipes.find((item) => item.id === 'query-overview-summary-table')
        : hasQuery && hasOverview
          ? model.rules.recipes.find((item) => item.id === 'query-overview-table')
          : hasQuery && (hasResultSummary || hasGenericSummary)
            ? model.rules.recipes.find((item) => item.id === 'query-summary-table')
            : null;

  if (recipe) {
    const skeleton = recipe.skeleton || recipe.skeletons?.[0] || 'query-workbench';
    return {
      strategy: 'composition',
      recipeId: recipe.id,
      skeleton,
      recipeStatus: recipe.runtimeStatus,
      availability: recipe.runtimeStatus === 'implemented' ? 'available' : 'model-only',
      reason: `需求命中组合配方 ${recipe.id}`,
      modelVersion: model.registry.modelVersion,
      directorRulesVersion: model.director.runtimePolicy.version,
      presentationPolicy: model.director.runtimePolicy
    };
  }

  const legacyIntent = model.domain.intents.find((intent) => intent.signals.some((signal) => source.includes(signal)));
  const family = model.legacy.families.find((item) => item.id === legacyIntent?.executionFamily);
  return {
    strategy: 'legacy-adapter',
    recipeId: null,
    skeleton: legacyIntent?.executionFamily === 'list' ? 'query-workbench' : null,
    family: legacyIntent?.executionFamily || null,
    templateId: legacyIntent?.templateId || null,
    availability: family?.availability || 'unknown',
    reason: '需求未命中跨区域或跨页面组合，使用 v1 Page Spec 兼容适配器。',
    modelVersion: model.registry.modelVersion,
    directorRulesVersion: model.director.runtimePolicy.version,
    presentationPolicy: model.director.runtimePolicy
  };
}

export function strategyCommands(root = process.cwd()) {
  return readCapabilityPolicy(root).domain.adapter.execution;
}
