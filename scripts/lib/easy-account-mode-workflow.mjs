import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolvePageStrategy } from './easy-account-capability-policy.mjs';

const DOMAIN_PATH = 'modules/easy-account/domain.json';
const POLICY_PATH = 'modules/easy-account/execution/generation-policy.json';
const MODE_RULES_PATH = 'modules/easy-account/execution/mode-workflows.md';
const PRD_STANDARD_PATH = 'modules/easy-account/product/prd-standard.md';

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function command(mode) {
  return `node scripts/prepare-easy-account-mode.mjs --mode ${mode} --request "<原始需求>" --change changes/{change-id}`;
}

function finalizeCommand(mode) {
  return `node scripts/finalize-easy-account-mode.mjs --mode ${mode} --change changes/{change-id}`;
}

function resolveIntent(request, domain, policy, root) {
  const strategy = resolvePageStrategy(request, root);
  if (strategy.strategy === 'composition') {
    const family = strategy.skeleton === 'form-workflow' ? 'form' : strategy.skeleton === 'result-workflow' ? 'result' : 'list';
    return {
      id: strategy.recipeId,
      pageType: 'composition',
      family,
      templateId: strategy.recipeId,
      strategy: strategy.strategy,
      recipeId: strategy.recipeId,
      skeleton: strategy.skeleton,
      availability: strategy.availability,
      mode: 'composition',
      reason: strategy.reason
    };
  }
  const intentPriority = ['dashboard', 'result', 'drawer-form', 'modal-form', 'detail', 'form', 'query-list'];
  const candidates = intentPriority.flatMap((id, priority) => {
    const intent = domain.intents.find((candidate) => candidate.id === id);
    if (!intent) return [];
    const matchedSignals = intent.signals.filter((signal) => request.includes(signal));
    if (!matchedSignals.length) return [];
    return [{ intent, priority, signalLength: Math.max(...matchedSignals.map((signal) => signal.length)) }];
  });
  candidates.sort((left, right) => right.signalLength - left.signalLength || left.priority - right.priority);
  const intent = candidates[0]?.intent;
  if (!intent) return null;
  const family = policy.families.find((item) => item.id === intent.executionFamily);
  return {
    id: intent.id,
    pageType: intent.pageType,
    family: intent.executionFamily,
    templateId: intent.templateId,
    availability: family?.availability || 'unknown',
    mode: family?.mode || 'unknown'
  };
}

export function createModeWorkflow(mode, request, root = process.cwd()) {
  if (!['prd', 'design', 'full'].includes(mode)) throw new Error(`Unsupported available mode: ${mode}`);
  const domain = readJson(root, DOMAIN_PATH);
  const policy = readJson(root, POLICY_PATH);
  const resources = domain.adapter.resources;
  const requirementResources = [PRD_STANDARD_PATH, ...resources.requirement];
  const route = resolveIntent(request, domain, policy, root);
  const composition = route?.strategy === 'composition';
  const familyContextResources = route?.family && domain.adapter.execution.familyContexts[route.family]
    ? [domain.adapter.execution.coreContext, domain.adapter.execution.familyContexts[route.family]]
    : [domain.adapter.execution.coreContext];
  const templateResources = composition
    ? resources.template
    : resources.template.filter((resource) => !resource.includes('/capability-model/'));
  const sourceSpec = composition ? 'page-composition.json' : 'page-spec.json';
  const scaffoldCommand = composition ? domain.adapter.execution.compositionScaffoldCommand : domain.adapter.execution.scaffoldCommand;
  const buildCommand = composition ? domain.adapter.execution.compositionBuildCommand : domain.adapter.execution.buildCommand;
  const validateCommand = composition ? domain.adapter.execution.compositionValidateCommand : undefined;
  const common = {
    id: `easy-account-${mode}-delivery`,
    mode,
    request,
    changeConvention: 'changes/YYYYMMDD-feature-name',
    prepareCommand: command(mode),
    finalizeCommand: finalizeCommand(mode),
    workflowRules: MODE_RULES_PATH,
    policy: POLICY_PATH,
    policyVersion: policy.policyVersion,
    route,
    execution: 'agent-authored-script-validated',
    boundaries: {
      preserveOriginalRequest: true,
      browserAutomation: false,
      visualAcceptance: 'human',
      naturalModeIsolation: true
    }
  };

  if (mode === 'prd') {
    return {
      ...common,
      stages: [
        {
          id: 'requirement',
          resources: requirementResources,
          editableOutputs: ['requirement.md']
        },
        { id: 'finalize', generatedOutputs: ['mode-delivery.json'] }
      ],
      requiredOutputs: ['requirement.md'],
      forbiddenActions: ['generate-page-spec', 'build-preview', 'load-design-resources']
    };
  }

  const designStages = [
    {
      id: 'requirement',
      resources: requirementResources,
      editableOutputs: ['requirement.md']
    },
    {
      id: 'design',
      resources: [...resources.design, ...templateResources, POLICY_PATH],
      editableOutputs: ['page-design.md', 'rules-read.md']
    },
    {
      id: 'preview-if-available',
      resources: [
        ...familyContextResources,
        ...resources.generate
      ],
      editableOutputs: [sourceSpec],
      fallbackOutput: 'capability-gap.md',
      ...(route ? {} : { clarification: '请明确页面意图：查询列表、表单、详情、结果或 Dashboard。' }),
      scaffoldCommand,
      buildCommand,
      validateCommand
    }
  ];

  if (mode === 'design') {
    return {
      ...common,
      stages: [...designStages, { id: 'finalize', generatedOutputs: ['mode-delivery.json'] }],
      requiredOutputs: ['requirement.md', 'page-design.md', 'rules-read.md'],
      conditionalOutputs: {
        available: [sourceSpec, 'preview.html'],
        unavailable: ['capability-gap.md']
      }
    };
  }

  return {
    ...common,
    stages: [
      ...designStages,
      {
        id: 'implement',
        resources: resources.generate,
        editableOutputs: ['tasks.md', 'implementation.md']
      },
      {
        id: 'review',
        resources: resources.review,
        editableOutputs: ['review.md'],
        generatedOutputs: ['mode-delivery.json']
      }
    ],
    requiredOutputs: [
      'requirement.md',
      'page-design.md',
      'rules-read.md',
      sourceSpec,
      'tasks.md',
      'implementation.md',
      'review.md',
      'preview.html'
    ],
    unavailableBehavior: 'blocked-with-capability-gap'
  };
}
