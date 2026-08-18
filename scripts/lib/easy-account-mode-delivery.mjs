import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';

export const AVAILABLE_MODES = ['prd', 'design', 'full'];

export function assertMode(mode) {
  if (!AVAILABLE_MODES.includes(mode)) throw new Error(`mode must be one of: ${AVAILABLE_MODES.join(', ')}.`);
  return mode;
}

export function assertChangePath(root, changeArg, { mustExist = false } = {}) {
  if (!/^changes\/\d{8}-[a-z0-9-]+$/.test(changeArg || '')) {
    throw new Error('Change must match changes/YYYYMMDD-feature-name.');
  }
  const changesRoot = resolve(root, 'changes');
  const changeDir = resolve(root, changeArg);
  if (!changeDir.startsWith(`${changesRoot}/`)) throw new Error('Change must stay inside changes/.');
  if (mustExist && !existsSync(changeDir)) throw new Error(`Change does not exist: ${changeArg}.`);
  return changeDir;
}

export function prepareMode({ root, mode, request, change }) {
  assertMode(mode);
  const normalizedRequest = String(request || '').trim();
  if (!normalizedRequest) throw new Error('A non-empty original request is required.');
  const changeDir = assertChangePath(root, change);
  const existed = existsSync(changeDir);
  mkdirSync(changeDir, { recursive: true });
  const statePath = resolve(changeDir, 'mode-state.json');
  const nextState = {
    schemaVersion: 1,
    system: 'easy-account',
    mode,
    changeId: basename(changeDir),
    originalRequest: normalizedRequest
  };
  if (existsSync(statePath)) {
    const current = JSON.parse(readFileSync(statePath, 'utf8'));
    if (current.system !== nextState.system || current.mode !== mode || current.originalRequest !== normalizedRequest) {
      throw new Error('Existing mode-state.json belongs to a different mode or request.');
    }
    return { changeDir, statePath, reused: true, state: current };
  }
  if (existed && readdirSync(changeDir).some((name) => name !== '.DS_Store')) {
    throw new Error('Existing non-empty Change has no mode-state.json; choose a new Change or migrate it explicitly.');
  }
  writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  return { changeDir, statePath, reused: false, state: nextState };
}

export function readModeState(root, change, expectedMode) {
  const changeDir = assertChangePath(root, change, { mustExist: true });
  const statePath = resolve(changeDir, 'mode-state.json');
  if (!existsSync(statePath)) throw new Error('mode-state.json is missing; run the prepare command first.');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (state.system !== 'easy-account') throw new Error('mode-state.json is not for Easy Account.');
  if (state.changeId !== basename(changeDir)) throw new Error('mode-state changeId does not match the directory.');
  if (state.mode !== expectedMode) throw new Error(`Change was prepared for ${state.mode}, not ${expectedMode}.`);
  if (!String(state.originalRequest || '').trim()) throw new Error('mode-state originalRequest is empty.');
  return { changeDir, statePath, state };
}

export function requireFiles(changeDir, names) {
  const missing = names.filter((name) => !existsSync(resolve(changeDir, name)));
  if (missing.length) throw new Error(`Missing required outputs: ${missing.join(', ')}.`);
}

export function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function relativeOutputs(root, changeDir, names) {
  return names.filter((name) => existsSync(resolve(changeDir, name))).map((name) => relative(root, resolve(changeDir, name)));
}
