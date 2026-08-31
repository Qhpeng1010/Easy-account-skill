import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RULE_DIR = 'modules/easy-account/director-rules';
const RULE_FILES = [
  '01-visual-constitution.md',
  '02-template-application-rules.md',
  '03-interaction-acceptance-rules.md'
];

function sourceFor(root) {
  return RULE_FILES.map((file) => ({
    file,
    source: readFileSync(resolve(root, RULE_DIR, file), 'utf8')
  }));
}

function ruleIndex(sources) {
  const index = {};
  for (const { file, source } of sources) {
    const matches = [...source.matchAll(/\*\*(EA-(?:VIS|TPL|INT)-\d{3})\*\*\s*([^\n]+)/g)];
    for (const match of matches) index[match[1]] = { id: match[1], summary: match[2].trim(), file };
  }
  return index;
}

function parseThresholds(sources) {
  const source = sources.map((item) => item.source).join('\n');
  const thresholdRule = source.match(/EA-TPL-007[\s\S]*?不超过\s*(\d+)\s*项[\s\S]*?超过\s*\1\s*项且不超过\s*(\d+)\s*项[\s\S]*?超过\s*\2\s*项/);
  if (!thresholdRule) throw new Error('EA-TPL-007 field presentation thresholds could not be parsed from director-rules.');
  const modalMaxFields = Number(thresholdRule[1]);
  const drawerMaxFields = Number(thresholdRule[2]);
  const queryRule = source.match(/EA-TPL-003[\s\S]*?(?:不超过|最多)\s*(\d+)\s*(?:项|个)/);
  if (!queryRule) throw new Error('EA-TPL-003 query field limit could not be parsed from director-rules.');
  const queryCollapseRule = source.match(/EA-TPL-003[^\n]*?普通查询列表的条件超过\s*(\d+)\s*个时/);
  if (!queryCollapseRule) throw new Error('EA-TPL-003 query collapse threshold could not be parsed from director-rules.');
  return {
    modalMaxFields,
    drawerMaxFields,
    pageMinFields: drawerMaxFields + 1,
    queryBasicMaxFields: Number(queryRule[1]),
    queryCollapseThreshold: Number(queryCollapseRule[1])
  };
}

export function readDirectorRules(root = process.cwd()) {
  const sources = sourceFor(root);
  const rules = ruleIndex(sources);
  const thresholds = parseThresholds(sources);
  const sourceHash = createHash('sha256').update(sources.map((item) => item.source).join('\n')).digest('hex').slice(0, 12);
  const runtimePolicy = {
    version: `director-rules-${sourceHash}`,
    ruleIds: Object.keys(rules).sort(),
    thresholds,
    formPresentation: { modalMaxFields: thresholds.modalMaxFields, drawerMaxFields: thresholds.drawerMaxFields, pageMinFields: thresholds.pageMinFields },
    detailPresentation: { listDefault: 'drawer', complexFallback: 'page' },
    query: {
      basicMaxFields: thresholds.queryBasicMaxFields,
      collapseThreshold: thresholds.queryCollapseThreshold
    }
  };
  return { files: RULE_FILES.map((file) => `${RULE_DIR}/${file}`), rules, runtimePolicy };
}

export function resolveFormPresentation(fieldCount, policy) {
  const thresholds = policy?.thresholds || policy?.formPresentation || {};
  const modalMax = Number(thresholds.modalMaxFields ?? 6);
  const drawerMax = Number(thresholds.drawerMaxFields ?? 12);
  if (fieldCount > drawerMax) return 'page';
  if (fieldCount > modalMax) return 'drawer';
  return 'modal';
}

export function resolveDetailPresentation(policy, complex = false) {
  return complex ? (policy?.detailPresentation?.complexFallback || 'page') : (policy?.detailPresentation?.listDefault || 'drawer');
}

export function assertRuleRefs(ruleRefs, directorRules) {
  const known = new Set(directorRules.runtimePolicy.ruleIds);
  return (ruleRefs || []).filter((id) => !known.has(id));
}
