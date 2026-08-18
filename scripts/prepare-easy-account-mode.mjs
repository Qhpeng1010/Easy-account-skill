#!/usr/bin/env node
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareMode } from './lib/easy-account-mode-delivery.mjs';

const args = process.argv.slice(2);

function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}

export function prepareEasyAccountMode({ mode, request, change, root = process.cwd() }) {
  const prepared = prepareMode({ root, mode, request, change });
  return {
    status: 'prepared',
    mode,
    change: relative(root, prepared.changeDir),
    state: relative(root, prepared.statePath),
    reused: prepared.reused,
    next: '按统一分发入口返回的阶段和资源生成可编辑产物，然后运行 finalizeCommand。'
  };
}

function main() {
  try {
    const result = prepareEasyAccountMode({
      mode: arg('--mode'),
      request: arg('--request'),
      change: arg('--change')
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(`easy-account-mode-prepare: failed\n- ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
