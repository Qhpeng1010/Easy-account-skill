#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEasyAccountCommand, readCommandContract } from './lib/easy-account-command.mjs';
import { resolveEasyAccountDomain } from './lib/easy-account-domain.mjs';
import { createModeWorkflow } from './lib/easy-account-mode-workflow.mjs';
import { createNaturalWorkflow } from './lib/easy-account-natural-workflow.mjs';

const args = process.argv.slice(2);

function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}

function dispatch(rawRequest, root = process.cwd()) {
  const contract = readCommandContract(root);
  const parsed = parseEasyAccountCommand(rawRequest, contract);
  if (parsed.status !== 'resolved') return parsed;
  const domain = resolveEasyAccountDomain(parsed.request, root);
  if (domain.status === 'outside-domain' || domain.status === 'clarify-target') {
    return {
      ...parsed,
      status: domain.status,
      domain,
      reason: domain.reason,
      question: domain.question
    };
  }

  if (parsed.mode === contract.defaultMode.id) {
    return {
      ...parsed,
      status: 'natural-generation',
      domain,
      reason: contract.defaultMode.description,
      workflow: createNaturalWorkflow(parsed.request, root)
    };
  }

  const command = contract.commands.find((item) => item.id === parsed.mode);
  const available = command.implementationStatus === 'available';
  return {
    ...parsed,
    status: 'mode-selected',
    domain,
    reason: command.description,
    contract: command,
    ...(available ? { workflow: createModeWorkflow(parsed.mode, parsed.request, root) } : {}),
    next: available
      ? '选择或创建 Change，运行 prepareCommand，按阶段生成产物，再运行 finalizeCommand。'
      : '快捷模式已完成路由契约，执行流水线将在后续阶段接入。'
  };
}

function print(result) {
  if (!args.includes('--text')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  console.log(`easy-account-command: ${result.status}`);
  if (result.mode) console.log(`- mode: ${result.mode}`);
  if (result.reason) console.log(`- ${result.reason}`);
  if (result.question) console.log(`- question: ${result.question}`);
  if (result.next) console.log(`- next: ${result.next}`);
}

function main() {
  try {
    const request = arg('--request');
    if (!request) throw new Error('Usage: node scripts/dispatch-easy-account-command.mjs --request "<request>" [--text]');
    const result = dispatch(request);
    print(result);
    if (result.status === 'unknown-command') process.exitCode = 2;
  } catch (error) {
    console.error(`easy-account-command: failed\n- ${error.message}`);
    process.exitCode = 1;
  }
}

export { dispatch };

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
