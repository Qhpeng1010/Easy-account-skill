#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertMode,
  readModeState,
  relativeOutputs,
  requireFiles,
  sha256
} from './lib/easy-account-mode-delivery.mjs';
import { validatePrdFile } from './lib/easy-account-prd-validation.mjs';
import { validateCompositionFile } from './lib/easy-account-page-composition.mjs';
import { validatePageSpec as validateLegacyPageSpec } from './lib/easy-account-page-spec.mjs';

const args = process.argv.slice(2);
const POLICY_PATH = 'modules/easy-account/execution/generation-policy.json';
const GENERATED_NAMES = ['preview.html', 'page-spec-runtime.js', 'business.css', 'preview-app.js'];
const COMPOSITION_GENERATED_NAMES = ['preview.html', 'page-composition-runtime.js', 'business.css', 'preview-app.js'];
const REVIEW_START = '<!-- easy-account-static-checks:start -->';
const REVIEW_END = '<!-- easy-account-static-checks:end -->';

function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function validateDesignDocument(changeDir) {
  const source = readFileSync(resolve(changeDir, 'page-design.md'), 'utf8');
  const missing = ['页面方案', '规则证据', '排除方案', '待人工验收'].filter((heading) => !new RegExp(`^## ${heading}$`, 'm').test(source));
  if (missing.length) throw new Error(`page-design.md is missing sections: ${missing.join(', ')}.`);
}

function validateRulesRead(changeDir) {
  const source = readFileSync(resolve(changeDir, 'rules-read.md'), 'utf8');
  const required = [
    'modules/easy-account/DOMAIN.md',
    'modules/easy-account/business-rules.md',
    'modules/easy-account/director-rules/01-visual-constitution.md',
    'modules/easy-account/director-rules/02-template-application-rules.md',
    'modules/easy-account/director-rules/03-interaction-acceptance-rules.md',
    'modules/easy-account/execution/capability-model/capability-model.md',
    'modules/easy-account/execution/capability-model/capability-registry.json',
    'modules/easy-account/execution/capability-model/composition-rules.json',
    POLICY_PATH
  ];
  const missing = required.filter((resource) => !source.includes(resource));
  if (missing.length) throw new Error(`rules-read.md does not record required resources: ${missing.join(', ')}.`);
}

function validateCapabilityGap(changeDir) {
  const file = resolve(changeDir, 'capability-gap.md');
  if (!existsSync(file)) throw new Error('Design mode requires page-spec.json or capability-gap.md.');
  const source = readFileSync(file, 'utf8');
  const missing = ['页面意图', '当前状态', '缺失能力', '后续建议'].filter((heading) => !new RegExp(`^## ${heading}$`, 'm').test(source));
  if (missing.length) throw new Error(`capability-gap.md is missing sections: ${missing.join(', ')}.`);
}

function validateCompositionSpec(root, changeDir) {
  const specPath = resolve(changeDir, 'page-composition.json');
  const result = validateCompositionFile(specPath, root);
  if (!result.valid) throw new Error(`page-composition.json is invalid: ${result.errors.join(' ')}`);
  writeFileSync(resolve(changeDir, 'composition-validation.json'), `${JSON.stringify({
    schemaVersion: 1,
    system: 'easy-account',
    source: relative(root, specPath),
    ...result
  }, null, 2)}\n`);
  return result;
}

function validatePageSpec(root, changeDir, state) {
  const specPath = resolve(changeDir, 'page-spec.json');
  const spec = readJson(specPath);
  const directorValidation = validateLegacyPageSpec(spec, root);
  if (!directorValidation.valid) throw new Error(`page-spec director-rule validation failed: ${directorValidation.errors.join(' ')}`);
  const policy = readJson(resolve(root, POLICY_PATH));
  if (spec.schemaVersion !== 1) throw new Error('page-spec.json schemaVersion must be 1.');
  if (spec.metadata?.changeId !== basename(changeDir)) throw new Error('page-spec metadata.changeId must match the Change directory.');
  if (spec.metadata?.request !== state.originalRequest) throw new Error('page-spec metadata.request must preserve the original request exactly.');
  if (spec.ui?.system !== 'easy-account' || spec.ui?.runtime !== 'easy-account-page-spec') throw new Error('page-spec must use the Easy Account runtime.');
  const family = policy.families.find((item) => item.id === spec.metadata?.family);
  if (!family) throw new Error(`Unknown page family: ${spec.metadata?.family || 'missing'}.`);
  if (family.availability !== 'available') throw new Error(`Page family ${family.id} is ${family.availability}; write capability-gap.md instead.`);
  const capabilities = spec.content?.capabilities;
  if (!Array.isArray(capabilities) || capabilities.length === 0) throw new Error('page-spec content.capabilities must be a non-empty array.');
  const unsupported = capabilities.filter((capability) => !family.capabilities.includes(capability));
  if (unsupported.length) throw new Error(`Unsupported ${family.id} capabilities: ${unsupported.join(', ')}.`);
  const section = spec[family.id];
  if (!section || typeof section !== 'object') throw new Error(`page-spec must include the ${family.id} section.`);
  if (!Array.isArray(spec.metadata?.ruleRefs) || spec.metadata.ruleRefs.length === 0) throw new Error('page-spec metadata.ruleRefs must be non-empty.');
  return { spec, specPath, family, policy };
}

function runNode(root, script, scriptArgs) {
  const executed = spawnSync(process.execPath, [resolve(root, script), ...scriptArgs], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (executed.error?.code === 'ETIMEDOUT') throw new Error(`${script} exceeded 30 seconds.`);
  if (executed.error || executed.status !== 0) throw new Error(executed.stderr || executed.stdout || `${script} failed.`);
  return executed.stdout.trim();
}

function checkJavaScript(root, file) {
  const executed = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (executed.error?.code === 'ETIMEDOUT') throw new Error(`JavaScript syntax check exceeded 30 seconds: ${file}.`);
  if (executed.error || executed.status !== 0) throw new Error(executed.stderr || executed.stdout || `JavaScript syntax check failed: ${file}.`);
}

function validateBuild(root, changeDir, specPath) {
  const specArg = relative(root, specPath);
  const buildOutput = runNode(root, 'scripts/build-easy-account-page-spec.mjs', [specArg]);
  const build = readJson(resolve(changeDir, 'page-spec-build.json'));
  for (const name of GENERATED_NAMES) {
    const file = resolve(changeDir, name);
    if (!existsSync(file)) throw new Error(`Build output is missing: ${name}.`);
    if (build.generated?.[name] !== sha256(file)) throw new Error(`Build hash mismatch: ${name}.`);
  }
  for (const name of ['page-spec-runtime.js', 'preview-app.js', 'shell-runtime.js', 'shell-config.example.js']) {
    checkJavaScript(root, resolve(changeDir, name));
  }
  return buildOutput;
}

function validateCompositionBuild(root, changeDir, specPath) {
  const specArg = relative(root, specPath);
  const buildOutput = runNode(root, 'scripts/build-easy-account-page-composition.mjs', [specArg]);
  const build = readJson(resolve(changeDir, 'composition-build.json'));
  for (const name of COMPOSITION_GENERATED_NAMES) {
    const file = resolve(changeDir, name);
    if (!existsSync(file)) throw new Error(`Composition build output is missing: ${name}.`);
    if (build.generated?.[name] !== sha256(file)) throw new Error(`Composition build hash mismatch: ${name}.`);
  }
  for (const name of ['page-composition-runtime.js', 'preview-app.js', 'shell-runtime.js', 'shell-config.example.js']) {
    checkJavaScript(root, resolve(changeDir, name));
  }
  return buildOutput;
}

function updateReview(changeDir, checks) {
  const reviewPath = resolve(changeDir, 'review.md');
  let source = readFileSync(reviewPath, 'utf8');
  const block = `${REVIEW_START}\n## 自动静态检查\n\n${checks.map((check) => `- [x] ${check}`).join('\n')}\n- [ ] 页面视觉、交互和真实业务结果由业务人员人工验收。\n${REVIEW_END}`;
  const pattern = new RegExp(`${REVIEW_START}[\\s\\S]*?${REVIEW_END}`);
  source = pattern.test(source) ? source.replace(pattern, block) : `${source.trimEnd()}\n\n${block}\n`;
  writeFileSync(reviewPath, source);
}

function delivery(mode, root, changeDir, state, status, outputs, checks, extra = {}) {
  const payload = {
    schemaVersion: 1,
    system: 'easy-account',
    mode,
    status,
    changeId: state.changeId,
    originalRequest: state.originalRequest,
    outputs: relativeOutputs(root, changeDir, outputs),
    checks,
    humanAcceptance: mode === 'prd' ? 'not-applicable' : 'pending',
    ...extra
  };
  const outputPath = resolve(changeDir, 'mode-delivery.json');
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  return { ...payload, delivery: relative(root, outputPath) };
}

export function finalizeEasyAccountMode({ mode, change, root = process.cwd() }) {
  assertMode(mode);
  const { changeDir, state } = readModeState(root, change, mode);
  requireFiles(changeDir, ['requirement.md']);
  validatePrdFile(resolve(changeDir, 'requirement.md'));
  const checks = ['公司 PRD 章节顺序和固定表头检查通过'];

  if (mode === 'prd') {
    const forbidden = ['page-design.md', 'page-spec.json', 'preview.html'].filter((name) => existsSync(resolve(changeDir, name)));
    if (forbidden.length) throw new Error(`PRD mode must not produce page or preview files: ${forbidden.join(', ')}.`);
    return delivery(mode, root, changeDir, state, 'completed', ['requirement.md'], checks);
  }

  requireFiles(changeDir, ['page-design.md', 'rules-read.md']);
  validateDesignDocument(changeDir);
  validateRulesRead(changeDir);
  checks.push('页面设计必需章节检查通过', '规则读取记录检查通过');
  const specPath = resolve(changeDir, 'page-spec.json');

  if (!existsSync(specPath)) {
    const compositionPath = resolve(changeDir, 'page-composition.json');
    const composition = existsSync(compositionPath) ? validateCompositionSpec(root, changeDir) : undefined;
    if (composition) checks.push('组合式 Page Spec 结构、区域、能力、绑定和转场检查通过');
    if (composition?.readiness === 'preview-ready') {
      if (mode === 'full') requireFiles(changeDir, ['tasks.md', 'implementation.md', 'review.md']);
      const buildOutput = validateCompositionBuild(root, changeDir, compositionPath);
      checks.push('组合式预览构建通过', '组合式派生产物哈希检查通过', '组合式 JavaScript 语法检查通过');
      const compositionOutputs = ['requirement.md', 'page-design.md', 'rules-read.md', 'page-composition.json', 'composition-validation.json', ...COMPOSITION_GENERATED_NAMES, 'composition-build.json', 'composition-checklist.md'];
      if (mode === 'design') return delivery(mode, root, changeDir, state, 'completed', compositionOutputs, checks, { compositionBuildOutput: buildOutput });
      updateReview(changeDir, checks);
      return delivery(mode, root, changeDir, state, 'completed', [...compositionOutputs, 'tasks.md', 'implementation.md', 'review.md'], checks, { compositionBuildOutput: buildOutput });
    }
    validateCapabilityGap(changeDir);
    checks.push('能力缺口记录检查通过');
    const compositionOutputs = composition ? ['page-composition.json', 'composition-validation.json'] : [];
    if (mode === 'full') {
      return delivery(mode, root, changeDir, state, 'blocked-with-capability-gap', [
        'requirement.md', 'page-design.md', 'rules-read.md', ...compositionOutputs, 'capability-gap.md'
      ], checks, { blocker: 'Full mode requires page-spec.json and a renderable preview.' });
    }
    return delivery(mode, root, changeDir, state, 'completed-with-capability-gap', [
      'requirement.md', 'page-design.md', 'rules-read.md', ...compositionOutputs, 'capability-gap.md'
    ], checks);
  }

  const { specPath: validatedSpecPath, family, policy } = validatePageSpec(root, changeDir, state);
  checks.push(`页面族 ${family.id} 与能力白名单检查通过`);
  if (mode === 'full') requireFiles(changeDir, ['tasks.md', 'implementation.md', 'review.md']);
  const buildOutput = validateBuild(root, changeDir, validatedSpecPath);
  checks.push('预览构建通过', '派生产物哈希检查通过', '派生 JavaScript 语法检查通过');

  if (mode === 'design') {
    return delivery(mode, root, changeDir, state, 'completed', [
      'requirement.md', 'page-design.md', 'rules-read.md', 'page-spec.json',
      ...GENERATED_NAMES, 'page-spec-build.json', 'page-spec-checklist.md'
    ], checks, { policyVersion: policy.policyVersion, buildOutput });
  }

  updateReview(changeDir, checks);
  return delivery(mode, root, changeDir, state, 'completed', [
    'requirement.md', 'page-design.md', 'rules-read.md', 'page-spec.json',
    'tasks.md', 'implementation.md', 'review.md', ...GENERATED_NAMES,
    'page-spec-build.json', 'page-spec-checklist.md'
  ], checks, { policyVersion: policy.policyVersion, buildOutput });
}

function main() {
  try {
    const result = finalizeEasyAccountMode({ mode: arg('--mode'), change: arg('--change') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(`easy-account-mode-finalize: failed\n- ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
