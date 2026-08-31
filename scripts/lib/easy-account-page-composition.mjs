import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertRuleRefs, readDirectorRules, resolveDetailPresentation, resolveFormPresentation } from './easy-account-director-rules.mjs';

const MODEL_ROOT = 'modules/easy-account/execution/capability-model';
const CHANGE_ID_PATTERN = /^[0-9]{8}-[^/\s]+$/;
const REGION_ID_PATTERN = /^[a-z][a-zA-Z0-9-]*$/;
const RULE_ID_PATTERN = /^EA-(VIS|TPL|INT)-[0-9]{3}$/;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function issue(errors, message) {
  errors.push(message);
}

function unique(items) {
  return new Set(items).size === items.length;
}

function validateProperties(errors, value, allowed, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) issue(errors, `${location} contains unsupported properties: ${unknown.join(', ')}.`);
}

function hasRegionType(regions, type) {
  return regions.some((region) => region?.type === type);
}

function requiredBindingCapability(binding) {
  if (binding.from?.scope === 'query' && binding.to?.regionType === 'overview') return 'binding.selectorToOverview';
  if (binding.from?.scope === 'query' && binding.to?.regionType === 'summary') return 'binding.queryToSummary';
  if (binding.from?.scope === 'row' && binding.to?.regionType === 'step-form') return 'binding.rowToForm';
  if (binding.from?.scope === 'submission' && binding.to?.regionType === 'result') return 'binding.submissionToResult';
  return '';
}

function validateVisibleTabKeys(errors, regions, region, location) {
  const visibleTabKeys = region.config?.visibleTabKeys;
  if (visibleTabKeys === undefined) return;
  const queryTabs = regions.find((item) => item?.type === 'query')?.config?.tabs;
  const queryTabKeys = Array.isArray(queryTabs) ? queryTabs.map((tab) => tab?.key) : [];
  if (!Array.isArray(visibleTabKeys) || visibleTabKeys.length === 0 || !visibleTabKeys.every((key) => typeof key === 'string' && key.trim())) {
    issue(errors, `${location}.config.visibleTabKeys must be a non-empty array of query Tab keys.`);
    return;
  }
  if (!unique(visibleTabKeys)) issue(errors, `${location}.config.visibleTabKeys must not contain duplicate Tab keys.`);
  const unknownTabKeys = visibleTabKeys.filter((key) => !queryTabKeys.includes(key));
  if (unknownTabKeys.length) issue(errors, `${location}.config.visibleTabKeys contains unknown query Tab keys: ${unknownTabKeys.join(', ')}.`);
}

export function readCompositionModel(root = process.cwd()) {
  const modelRoot = resolve(root, MODEL_ROOT);
  return {
    registry: readJson(resolve(modelRoot, 'capability-registry.json')),
    rules: readJson(resolve(modelRoot, 'composition-rules.json'))
  };
}

export function validatePageComposition(spec, root = process.cwd(), options = {}) {
  const errors = [];
  const warnings = [];
  const { registry, rules } = readCompositionModel(root);
  const director = readDirectorRules(root);
  const skeletons = new Map(registry.skeletons.map((item) => [item.id, item]));
  const regionTypes = new Map(registry.regions.map((item) => [item.id, item]));
  const capabilities = new Map(registry.capabilities.map((item) => [item.id, item]));
  const skeletonRules = new Map(rules.skeletonRules.map((item) => [item.skeleton, item]));

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { valid: false, errors: ['Page composition must be an object.'], warnings, readiness: 'invalid' };
  }
  validateProperties(errors, spec, ['schemaVersion', 'metadata', 'ui', 'skeleton', 'recipeId', 'regions', 'bindings', 'transitions', 'workflow', 'states', 'shell', 'directorPolicy'], 'Page composition');
  validateProperties(errors, spec.metadata, ['changeId', 'pageName', 'pageId', 'request', 'assumptions', 'ruleRefs'], 'metadata');
  validateProperties(errors, spec.ui, ['system', 'runtime', 'rendererVersion'], 'ui');
  if (spec.schemaVersion !== 2) issue(errors, 'schemaVersion must be 2 for a composition Page Spec.');
  if (spec.ui?.system !== 'easy-account' || spec.ui?.runtime !== 'easy-account-composition') issue(errors, 'ui must use the easy-account-composition runtime.');
  if (!Number.isInteger(spec.ui?.rendererVersion) || spec.ui.rendererVersion < 1) issue(errors, 'ui.rendererVersion must be a positive integer.');
  if (!CHANGE_ID_PATTERN.test(spec.metadata?.changeId || '')) issue(errors, 'metadata.changeId must use YYYYMMDD-name without spaces.');
  if (typeof spec.metadata?.pageName !== 'string' || !spec.metadata.pageName.trim()) issue(errors, 'metadata.pageName is required.');
  if (!Array.isArray(spec.metadata?.ruleRefs) || spec.metadata.ruleRefs.length === 0 || !spec.metadata.ruleRefs.every((id) => RULE_ID_PATTERN.test(id))) {
    issue(errors, 'metadata.ruleRefs must contain Easy Account rule IDs.');
  }
  const unknownRuleRefs = assertRuleRefs(spec.metadata?.ruleRefs, director);
  if (unknownRuleRefs.length) issue(errors, `metadata.ruleRefs contains unknown director rules: ${unknownRuleRefs.join(', ')}.`);
  if (spec.directorPolicy && spec.directorPolicy.version !== director.runtimePolicy.version) {
    issue(errors, `directorPolicy.version must match ${director.runtimePolicy.version}.`);
  }

  const skeleton = skeletons.get(spec.skeleton);
  const rule = skeletonRules.get(spec.skeleton);
  if (!skeleton || !rule) issue(errors, `Unknown skeleton: ${spec.skeleton || 'missing'}.`);

  const regions = Array.isArray(spec.regions) ? spec.regions : [];
  const workflowPageIds = options.workflowPageIds || new Set([
    spec.metadata?.pageId || 'root',
    ...(spec.workflow?.pages || []).map((page) => page?.id)
  ]);
  if (regions.length === 0) issue(errors, 'regions must be a non-empty array.');
  const regionIds = regions.map((region) => region?.id);
  if (!unique(regionIds)) issue(errors, 'region ids must be unique.');
  const regionTypeIds = regions.map((region) => region?.type);
  if (!unique(regionTypeIds)) issue(errors, 'each region type may appear at most once in one Page Spec.');
  const instances = new Map();

  regions.forEach((region, index) => {
    const location = `regions[${index}]`;
    if (!region || typeof region !== 'object' || Array.isArray(region)) {
      issue(errors, `${location} must be an object.`);
      return;
    }
    validateProperties(errors, region, ['id', 'type', 'capabilities', 'config'], location);
    if (!REGION_ID_PATTERN.test(region.id || '')) issue(errors, `${location}.id is invalid.`);
    const regionDefinition = regionTypes.get(region.type);
    if (!regionDefinition) issue(errors, `${location}.type is not registered: ${region.type || 'missing'}.`);
    if (rule && !rule.allowedRegions.includes(region.type)) issue(errors, `${location}.type ${region.type} is not allowed by ${spec.skeleton}.`);
    if (!Array.isArray(region.capabilities) || region.capabilities.length === 0 || !unique(region.capabilities)) issue(errors, `${location}.capabilities must be a non-empty unique array.`);
    for (const capabilityId of region.capabilities || []) {
      const capability = capabilities.get(capabilityId);
      if (!capability) issue(errors, `${location} declares unknown capability ${capabilityId}.`);
      else if (capability.region !== region.type) issue(errors, `${location} capability ${capabilityId} belongs to ${capability.region}, not ${region.type}.`);
    }
    if (region.type === 'query' && region.config?.collapseThreshold !== undefined
      && region.config.collapseThreshold !== director.runtimePolicy.query.collapseThreshold) {
      issue(errors, `${location}.config.collapseThreshold must match the fixed director rule value ${director.runtimePolicy.query.collapseThreshold}.`);
    }
    if (region.type === 'overview') {
      validateVisibleTabKeys(errors, regions, region, location);
      const managesOverview = region.capabilities?.includes('overview.manage');
      const management = region.config?.management;
      if (management?.visible !== undefined && typeof management.visible !== 'boolean') {
        issue(errors, `${location}.config.management.visible must be a boolean when provided.`);
      }
      if (managesOverview && (!management || typeof management !== 'object' || Array.isArray(management))) {
        issue(errors, `${location} with overview.manage requires config.management.`);
      }
      if (!managesOverview && management) issue(errors, `${location}.config.management requires overview.manage.`);
      if (managesOverview) {
        const fields = management?.fields;
        if (!Array.isArray(fields) || fields.length === 0 || fields.length > 6) {
          issue(errors, `${location}.config.management.fields must contain 1 to 6 fields.`);
        }
      }
      const metrics = [
        ...(region.config?.metrics || []),
        ...Object.values(region.config?.metricsBySelector || {}).flat(),
        ...Object.values(region.config?.metricsByTab || {}).flat()
      ];
      if (metrics.some((metric) => metric?.aggregate)) issue(errors, `${location} overview metrics must not declare aggregate; use a summary region for query-result aggregation.`);
    }
    if (region.type === 'summary') {
      validateVisibleTabKeys(errors, regions, region, location);
      const overviewOnlyKeys = ['selectorKey', 'metricsBySelector', 'management'].filter((key) => region.config?.[key] !== undefined);
      if (overviewOnlyKeys.length) issue(errors, `${location} summary config contains overview-only properties: ${overviewOnlyKeys.join(', ')}.`);
    }
    if (region.id) instances.set(region.id, { ...region, regionDefinition });
  });

  if (rule) {
    for (const requiredType of rule.requiredRegions) {
      if (!hasRegionType(regions, requiredType)) issue(errors, `${spec.skeleton} requires a ${requiredType} region.`);
    }
    let previousOrder = -1;
    for (const region of regions) {
      const order = rule.order.indexOf(region?.type);
      if (order < 0) continue;
      if (order < previousOrder) issue(errors, `${spec.skeleton} region order must follow: ${rule.order.join(' -> ')}.`);
      previousOrder = order;
    }
  }

  const bindings = Array.isArray(spec.bindings) ? spec.bindings : [];
  const bindingIds = bindings.map((binding) => binding?.id);
  if (!unique(bindingIds)) issue(errors, 'binding ids must be unique.');
  bindings.forEach((binding, index) => {
    const location = `bindings[${index}]`;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
      issue(errors, `${location} must be an object.`);
      return;
    }
    validateProperties(errors, binding, ['id', 'from', 'to', 'mode', 'required', 'transform', 'transformConfig'], location);
    validateProperties(errors, binding.from, ['pageId', 'scope', 'path'], `${location}.from`);
    validateProperties(errors, binding.to, ['pageId', 'region', 'path'], `${location}.to`);
    if (!REGION_ID_PATTERN.test(binding.id || '')) issue(errors, `${location}.id is invalid.`);
    if (!['context', 'query', 'row', 'form', 'submission', 'result'].includes(binding.from?.scope) || !binding.from?.path) issue(errors, `${location}.from requires a registered scope and path.`);
    const externalTarget = binding.to?.pageId && binding.to.pageId !== (spec.metadata?.pageId || 'root');
    if (externalTarget && !workflowPageIds.has(binding.to.pageId)) issue(errors, `${location}.to.pageId must reference a workflow page.`);
    const target = externalTarget ? undefined : instances.get(binding.to?.region);
    if ((!externalTarget && !target) || !binding.to?.path) issue(errors, `${location}.to must reference an existing region id and path.`);
    if (!['initial', 'filter', 'submit', 'result', 'context'].includes(binding.mode)) issue(errors, `${location}.mode is invalid.`);
    if (binding.transform && !['identity', 'pick', 'map', 'aggregate'].includes(binding.transform)) issue(errors, `${location}.transform is invalid.`);
    if (binding.from?.scope === 'query' && !hasRegionType(regions, 'query')) issue(errors, `${location} reads query state without a query region.`);
    if (binding.from?.scope === 'row' && !hasRegionType(regions, 'table')) issue(errors, `${location} reads row state without a table region.`);
    if (binding.from?.scope === 'form' && !hasRegionType(regions, 'step-form')) issue(errors, `${location} reads form state without a step-form region.`);
    if (binding.from?.scope === 'submission' && !hasRegionType(regions, 'step-form')) issue(errors, `${location} reads submission state without a step-form region.`);
    const requiredCapability = target ? requiredBindingCapability({ ...binding, to: { ...binding.to, regionType: target.type } }) : '';
    if (requiredCapability && !target.capabilities.includes(requiredCapability)) issue(errors, `${location} requires ${requiredCapability} on target region ${target.id}.`);
  });

  const transitions = Array.isArray(spec.transitions) ? spec.transitions : [];
  const transitionIds = transitions.map((transition) => transition?.id);
  if (!unique(transitionIds)) issue(errors, 'transition ids must be unique.');
  transitions.forEach((transition, index) => {
    const location = `transitions[${index}]`;
    if (!transition || typeof transition !== 'object' || Array.isArray(transition)) {
      issue(errors, `${location} must be an object.`);
      return;
    }
    validateProperties(errors, transition, ['id', 'from', 'event', 'to', 'requires', 'bindingIds', 'presentation'], location);
    if (!transition.id || !transition.event || !transition.to) issue(errors, `${location} requires id, event and to.`);
    if (!skeletons.has(transition.to) && !workflowPageIds.has(transition.to)) issue(errors, `${location}.to must reference a registered skeleton or workflow page.`);
    if (!Array.isArray(transition.requires) || transition.requires.length === 0) issue(errors, `${location}.requires must declare registered capabilities.`);
    for (const capabilityId of transition.requires || []) {
      if (!capabilities.has(capabilityId)) issue(errors, `${location} requires unknown capability ${capabilityId}.`);
    }
    const registeredTransition = rules.transitions.find((item) => item.id === transition.id);
    if (!registeredTransition) warnings.push(`${location}.id ${transition.id} is structurally valid but not registered in composition-rules.json.`);
    else if (registeredTransition.event !== transition.event || (!workflowPageIds.has(transition.to) && registeredTransition.to !== transition.to)) issue(errors, `${location} does not match registered transition ${transition.id}.`);
    for (const bindingId of transition.bindingIds || []) {
      if (!bindingIds.includes(bindingId)) issue(errors, `${location}.bindingIds references unknown binding ${bindingId}.`);
    }
    if (transition.presentation && !['modal', 'drawer', 'page'].includes(transition.presentation)) issue(errors, `${location}.presentation must be modal, drawer or page.`);
  });

  let recipe;
  if (spec.recipeId) {
    recipe = rules.recipes.find((item) => item.id === spec.recipeId);
    if (!recipe) issue(errors, `recipeId ${spec.recipeId} is not registered.`);
    else {
      const recipeSkeletons = recipe.skeletons || [recipe.skeleton];
      if (!recipeSkeletons.includes(spec.skeleton)) issue(errors, `recipeId ${spec.recipeId} does not allow skeleton ${spec.skeleton}.`);
    }
  } else {
    warnings.push('No recipeId declared; this composition is structural only and is not a registered delivery recipe.');
  }

  if (spec.workflow && !options.skipWorkflow) {
    validateProperties(errors, spec.workflow, ['pages'], 'workflow');
    const pages = Array.isArray(spec.workflow.pages) ? spec.workflow.pages : [];
    if (pages.length === 0) issue(errors, 'workflow.pages must be a non-empty array when workflow is declared.');
    const ids = pages.map((page) => page?.id);
    if (!unique(ids) || ids.includes(spec.metadata?.pageId || 'root')) issue(errors, 'workflow page ids must be unique and must not reuse the root page id.');
    for (const page of pages) {
      validateProperties(errors, page, ['id', 'label', 'skeleton', 'regions', 'bindings', 'transitions', 'states'], `workflow.pages.${page?.id || 'unknown'}`);
      const nested = {
        ...spec,
        metadata: { ...spec.metadata, pageId: page?.id, pageName: page?.label || '' },
        skeleton: page?.skeleton,
        regions: page?.regions,
        bindings: page?.bindings || [],
        transitions: page?.transitions || [],
        states: page?.states || {},
        workflow: undefined,
        recipeId: undefined
      };
      const nestedResult = validatePageComposition(nested, root, { workflowPageIds, skipWorkflow: true });
      nestedResult.errors.forEach((message) => issue(errors, `workflow.pages.${page?.id || 'unknown'}: ${message}`));
      nestedResult.warnings.forEach((message) => warnings.push(`workflow.pages.${page?.id || 'unknown'}: ${message}`));
    }
  }

  const workflowPages = Array.isArray(spec.workflow?.pages) ? spec.workflow.pages : [];
  const pagesById = new Map([[spec.metadata?.pageId || 'root', spec], ...workflowPages.map((page) => [page.id, page])]);
  const countFields = (page) => (page?.regions || []).find((item) => item.type === 'step-form')?.config?.steps
    ?.flatMap((step) => step.fields || []).filter((field) => field.interactive !== false && field.kind !== 'display').length || 0;
  for (const transition of transitions) {
    const target = pagesById.get(transition.to);
    if (!target) continue;
    const expected = target.skeleton === 'detail-workbench'
      ? resolveDetailPresentation(director.runtimePolicy)
      : target.skeleton === 'form-workflow' ? resolveFormPresentation(countFields(target), director.runtimePolicy) : 'page';
    if (transition.presentation && transition.presentation !== expected) {
      issue(errors, `transitions.${transition.id}.presentation ${transition.presentation} conflicts with director rules; expected ${expected}.`);
    }
  }

  if (recipe) {
    const workflowPages = Array.isArray(spec.workflow?.pages) ? spec.workflow.pages : [];
    const allSkeletons = [spec.skeleton, ...workflowPages.map((page) => page?.skeleton)];
    const allRegionTypes = [...regions, ...workflowPages.flatMap((page) => page?.regions || [])].map((item) => item?.type);
    const allDeclaredCapabilities = [...regions, ...workflowPages.flatMap((page) => page?.regions || [])].flatMap((item) => item?.capabilities || []);
    const recipeSkeletons = recipe.skeletons || [recipe.skeleton];
    recipeSkeletons.filter((id) => !allSkeletons.includes(id)).forEach((id) => issue(errors, `recipeId ${recipe.id} requires skeleton ${id}.`));
    (recipe.regions || []).filter((id) => !allRegionTypes.includes(id)).forEach((id) => issue(errors, `recipeId ${recipe.id} requires region ${id}.`));
    (recipe.capabilities || []).filter((id) => !allDeclaredCapabilities.includes(id)).forEach((id) => issue(errors, `recipeId ${recipe.id} requires capability ${id}.`));
  }

  const declaredCapabilities = regions.flatMap((region) => region?.capabilities || []);
  const unsupportedRuntime = [skeleton, ...regions.map((region) => regionTypes.get(region?.type)), ...declaredCapabilities.map((id) => capabilities.get(id))]
    .filter((item) => item && item.runtimeStatus !== 'implemented')
    .map((item) => item.id || item.label);
  if (recipe && recipe.runtimeStatus !== 'implemented') unsupportedRuntime.push(recipe.id);
  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    readiness: valid && unsupportedRuntime.length === 0 ? 'preview-ready' : (valid ? 'model-only' : 'invalid'),
    unsupportedRuntime: [...new Set(unsupportedRuntime)],
    modelVersion: registry.modelVersion,
    skeleton: spec.skeleton || '',
    recipeId: spec.recipeId || '',
    directorRules: director.runtimePolicy
  };
}

export function validateCompositionFile(file, root = process.cwd()) {
  if (!existsSync(file)) throw new Error(`Page composition file does not exist: ${file}`);
  return validatePageComposition(readJson(file), root);
}

export function generatedCompositionPreviewApp(spec) {
  const serialized = JSON.stringify(spec, null, 2).replace(/<\//g, '<\\/');
  const rootId = spec.metadata?.pageId || 'root';
  const primaryNav = spec.shell?.primaryNav || '易账通';
  const sideNav = spec.shell?.sideNav || spec.metadata?.pageName || '组合页面';
  return `// Derived from page-composition.json. Do not edit.\ndocument.addEventListener('DOMContentLoaded', function () {\n  const spec = ${serialized};\n  const rootPageId = ${JSON.stringify(rootId)};\n  const content = document.createElement('div');\n  const shellConfig = Object.assign({}, window.EASY_ACCOUNT_SHELL_CONFIG || {}, spec.shell || {});\n  const menu = [{ id: 'composition-primary', label: ${JSON.stringify(primaryNav)}, icon: 'AppstoreOutlined', open: true, children: [{ id: rootPageId, label: ${JSON.stringify(sideNav)}, active: true }] }];\n  const shell = window.EasyAccountShell.mount(Object.assign({}, shellConfig, { menu: menu, tabs: [{ id: rootPageId, label: spec.metadata.pageName, pinned: true, closable: false, content: content }], activeTabId: rootPageId }));\n  window.EasyAccountCompositionRuntime.mount(spec, shell);\n});\n`;
}
