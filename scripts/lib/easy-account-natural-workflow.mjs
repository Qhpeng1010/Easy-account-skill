import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolvePageStrategy } from './easy-account-capability-policy.mjs';

const DOMAIN_PATH = 'modules/easy-account/domain.json';

function readDomain(root) {
  return JSON.parse(readFileSync(resolve(root, DOMAIN_PATH), 'utf8'));
}

export function createNaturalWorkflow(request, root = process.cwd()) {
  const domain = readDomain(root);
  const { execution, resources } = domain.adapter;
  const strategy = resolvePageStrategy(request, root);
  const composition = strategy.strategy === 'composition';
  const family = strategy.family || (strategy.skeleton === 'form-workflow' ? 'form' : strategy.skeleton === 'result-workflow' ? 'result' : 'list');
  const familyContext = family && execution.familyContexts[family] ? [execution.coreContext, execution.familyContexts[family]] : [execution.coreContext];
  const templateResources = composition
    ? resources.template
    : resources.template.filter((resource) => !resource.includes('/capability-model/'));
  return {
    id: 'controlled-natural-generation',
    mode: 'natural',
    behavior: 'existing-default',
    request,
    editableSource: composition ? 'page-composition.json' : 'page-spec.json',
    strategy,
    stages: [
      { id: 'requirement', resources: resources.requirement },
      { id: 'design', resources: resources.design },
      { id: 'template', resources: templateResources },
      {
        id: 'generate',
        resources: [...familyContext, ...resources.generate],
        scaffoldCommand: composition ? execution.compositionScaffoldCommand : execution.scaffoldCommand,
        buildCommand: composition ? execution.compositionBuildCommand : execution.buildCommand,
        validateCommand: composition ? execution.compositionValidateCommand : undefined
      },
      { id: 'review', resources: resources.review, acceptance: 'human' }
    ],
    boundaries: {
      generatedFilesAreDerived: true,
      browserAutomation: false,
      visualAcceptance: 'human'
    }
  };
}
