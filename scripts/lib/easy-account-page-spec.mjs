import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

export const ROOT = resolve(new URL('../..', import.meta.url).pathname);
export const EXECUTION_ROOT = resolve(ROOT, 'modules/easy-account/execution');

export function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
export function pageSpecHash(spec) { return createHash('sha256').update(`${JSON.stringify(spec, null, 2)}\n`).digest('hex'); }

/* Legacy Page Spec validation helpers are intentionally disabled.
function issue(errors, condition, message) { if (!condition) errors.push(message); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function unique(values) { return new Set(values).size === values.length; }

function knownRuleIds(root) {
  const dir = resolve(root, 'modules/easy-account/director-rules');
  const source = ['01-visual-constitution.md', '02-template-application-rules.md', '03-interaction-acceptance-rules.md']
    .map((file) => readFileSync(resolve(dir, file), 'utf8')).join('\n');
  return new Set(source.match(/EA-(?:VIS|TPL|INT)-\d{3}/g) || []);
}

function validateField(errors, field, location) {
  issue(errors, field && typeof field === 'object' && !Array.isArray(field), `${location} must be an object.`);
  if (!field || typeof field !== 'object') return;
  issue(errors, text(field.key), `${location}.key is required.`);
  issue(errors, text(field.label), `${location}.label is required.`);
  issue(errors, ['input', 'textarea', 'select', 'radio', 'upload', 'number', 'date', 'date-range'].includes(field.control), `${location}.control is unsupported.`);
  if (['select', 'radio'].includes(field.control)) issue(errors, Array.isArray(field.options) && field.options.length > 0, `${location}.options are required for ${field.control}.`);
  (field.options || []).forEach((option, index) => {
    issue(errors, text(option?.label), `${location}.options[${index}].label is required.`);
    issue(errors, option && Object.hasOwn(option, 'value'), `${location}.options[${index}].value is required.`);
  });
}

function validateList(errors, spec, capabilities) {
  const list = spec.list;
  issue(errors, list && typeof list === 'object', 'list is required for family=list.');
  if (!list) return;
  const fields = list.query?.fields;
  issue(errors, Array.isArray(fields) && fields.length > 0, 'list.query.fields must be a non-empty array.');
  (fields || []).forEach((field, index) => validateField(errors, field, `list.query.fields[${index}]`));
  const hasBasic = capabilities.includes('query.basic');
  const hasAdvanced = capabilities.includes('query.advanced');
  issue(errors, Number(hasBasic) + Number(hasAdvanced) === 1, 'List requires exactly one query mode.');
  if (hasBasic) issue(errors, (fields || []).length <= 6, 'query.basic supports at most 6 fields.');
  const viewQueryFields = (list.table?.views || []).filter((view) => view.queryFields !== undefined);
  if (viewQueryFields.length) issue(errors, capabilities.includes('query.viewFields'), 'View-specific query fields require query.viewFields.');
  viewQueryFields.forEach((view, viewIndex) => {
    issue(errors, Array.isArray(view.queryFields) && view.queryFields.length > 0, `list.table.views[${viewIndex}].queryFields must be a non-empty array.`);
    (view.queryFields || []).forEach((field, fieldIndex) => validateField(errors, field, `list.table.views[${viewIndex}].queryFields[${fieldIndex}]`));
    issue(errors, unique((view.queryFields || []).map((field) => field.key)), `list.table.views[${viewIndex}].queryFields keys must be unique.`);
  });
  const table = list.table;
  issue(errors, table && typeof table === 'object', 'list.table is required.');
  if (!table) return;
  issue(errors, text(table.rowKey), 'list.table.rowKey is required.');
  issue(errors, Array.isArray(table.columns) && table.columns.length > 0, 'list.table.columns are required.');
  issue(errors, Array.isArray(table.rows), 'list.table.rows must be an array.');
  issue(errors, table.pagination && Number.isInteger(table.pagination.pageSize), 'list.table.pagination.pageSize is required.');
  issue(errors, capabilities.includes('table.flat'), 'List requires table.flat.');
  issue(errors, capabilities.includes('table.pagination'), 'List requires table.pagination.');
  const columns = table.columns || [];
  issue(errors, unique(columns.map((column) => column.key)), 'list.table column keys must be unique.');
  columns.forEach((column, index) => {
    issue(errors, text(column.key), `list.table.columns[${index}].key is required.`);
    issue(errors, text(column.label), `list.table.columns[${index}].label is required.`);
    if (column.format === 'status') issue(errors, capabilities.includes('table.status'), 'Status columns require table.status.');
    if (column.format === 'amount') issue(errors, capabilities.includes('table.amount'), 'Amount columns require table.amount.');
    if (column.format === 'stack') {
      issue(errors, capabilities.includes('table.stackCells'), 'Stacked columns require table.stackCells.');
      issue(errors, Array.isArray(column.lines) && column.lines.length > 1, `list.table.columns[${index}].lines must include at least two fields.`);
      (column.lines || []).forEach((line, lineIndex) => issue(errors, text(line?.source), `list.table.columns[${index}].lines[${lineIndex}].source is required.`));
    }
    if (column.actions) issue(errors, Array.isArray(column.actions), `list.table.columns[${index}].actions must be an array.`);
    (column.actions || []).forEach((action, actionIndex) => {
      const location = `list.table.columns[${index}].actions[${actionIndex}]`;
      issue(errors, text(action.key) && text(action.label), `${location} requires key and label.`);
      if (action.type === 'page-form') {
        issue(errors, capabilities.includes('list.rowPageForm'), `${location} requires list.rowPageForm.`);
        issue(errors, action.form && Array.isArray(action.form.groups) && action.form.groups.length > 0, `${location}.form.groups are required.`);
        const actionFields = (action.form?.groups || []).flatMap((group) => group.fields || []);
        actionFields.forEach((field, fieldIndex) => validateField(errors, field, `${location}.form.fields[${fieldIndex}]`));
        issue(errors, unique(actionFields.map((field) => field.key)), `${location}.form field keys must be unique.`);
        issue(errors, action.form?.submit && text(action.form.submit.primaryLabel), `${location}.form.submit.primaryLabel is required.`);
      }
    });
  });
  const rows = table.rows || [];
  const ids = rows.map((row) => row?.[table.rowKey]);
  issue(errors, ids.every((id) => id !== undefined && id !== null && id !== ''), `Every row requires ${table.rowKey}.`);
  issue(errors, unique(ids), `list.table.${table.rowKey} values must be unique.`);
  if (table.tools?.includes('settings')) issue(errors, capabilities.includes('table.columnSettings'), 'settings requires table.columnSettings.');
  if ((table.rowActions || []).some((action) => action.confirm)) issue(errors, capabilities.includes('table.confirmAction'), 'Confirmed actions require table.confirmAction.');
  if (table.pagination?.total !== undefined) issue(errors, table.pagination.total === rows.length, 'Prototype pagination.total must equal rows.length.');
  if (table.drawerDetail) {
    issue(errors, capabilities.includes('detail.drawer'), 'drawerDetail requires detail.drawer.');
    issue(errors, Array.isArray(table.drawerDetail.groups) && table.drawerDetail.groups.length > 0, 'drawerDetail.groups are required.');
  }
  if (table.primaryAction) {
    const action = table.primaryAction;
    const presentation = action.presentation || 'modal';
    const createForm = action.form;
    issue(errors, text(action.label), 'table.primaryAction.label is required.');
    issue(errors, ['modal', 'page'].includes(presentation), 'table.primaryAction.presentation must be modal or page.');
    issue(errors, createForm && typeof createForm === 'object', 'table.primaryAction.form is required.');
    if (!createForm) return;
    const createFields = presentation === 'page'
      ? (createForm.groups || []).flatMap((group) => group.fields || [])
      : (createForm.fields || []);
    createFields.forEach((field, index) => validateField(errors, field, `table.primaryAction.form.fields[${index}]`));
    issue(errors, unique(createFields.map((field) => field.key)), 'Create form field keys must be unique.');
    issue(errors, createForm.submit && text(createForm.submit.primaryLabel), 'table.primaryAction.form.submit.primaryLabel is required.');
    if (presentation === 'modal') {
      issue(errors, capabilities.includes('list.modalCreate'), 'Modal create requires list.modalCreate.');
      issue(errors, Array.isArray(createForm.fields) && createForm.fields.length > 0, 'Modal create requires form.fields.');
    }
    if (presentation === 'page') {
      issue(errors, capabilities.includes('list.pageCreate'), 'Page create requires list.pageCreate.');
      issue(errors, Array.isArray(createForm.groups) && createForm.groups.length >= 2, 'Page create requires at least two business groups.');
      issue(errors, createFields.length > 8 || (createForm.groups || []).length >= 2, 'Page create requires more than eight fields or multiple business groups.');
      issue(errors, createForm.stickyActions === true, 'Page create requires stickyActions=true.');
    }
  }
}

function fieldsForForm(form) {
  if (Array.isArray(form.fields)) return form.fields;
  if (Array.isArray(form.groups)) return form.groups.flatMap((group) => group.fields || []);
  if (Array.isArray(form.steps)) return form.steps.flatMap((step) => step.fields || []);
  return [];
}

function validateForm(errors, spec, capabilities) {
  const form = spec.form;
  issue(errors, form && typeof form === 'object', 'form is required for family=form.');
  if (!form) return;
  const structures = [Array.isArray(form.fields), Array.isArray(form.groups), Array.isArray(form.steps)].filter(Boolean).length;
  issue(errors, structures === 1, 'Form must declare exactly one of fields, groups or steps.');
  if (form.fields) issue(errors, capabilities.includes('form.simple'), 'form.fields requires form.simple.');
  if (form.groups) issue(errors, capabilities.includes('form.groups'), 'form.groups requires form.groups.');
  if (form.steps) issue(errors, capabilities.includes('form.steps'), 'form.steps requires form.steps.');
  fieldsForForm(form).forEach((field, index) => validateField(errors, field, `form.fields[${index}]`));
  issue(errors, unique(fieldsForForm(form).map((field) => field.key)), 'Form field keys must be unique.');
  issue(errors, form.submit && text(form.submit.primaryLabel), 'form.submit.primaryLabel is required.');
}

function validateDetail(errors, spec, capabilities) {
  const detail = spec.detail;
  issue(errors, detail && typeof detail === 'object', 'detail is required for family=detail.');
  if (!detail) return;
  issue(errors, Array.isArray(detail.groups) && detail.groups.length > 0, 'detail.groups are required.');
  issue(errors, capabilities.includes('detail.groups'), 'Detail requires detail.groups.');
  (detail.groups || []).forEach((group, index) => {
    issue(errors, text(group.key) && text(group.title), `detail.groups[${index}] requires key and title.`);
    issue(errors, Array.isArray(group.fields) || group.table, `detail.groups[${index}] requires fields or table.`);
  });
}
*/

export function resolveShellActiveTabId(shell = {}, shellConfig = {}) {
  if (typeof shell.activeTabId === 'string' && shell.activeTabId.trim()) return shell.activeTabId;
  const groups = Array.isArray(shellConfig.menu) ? shellConfig.menu : [];
  const primaryGroup = groups.find((group) => group?.label === shell.primaryNav);
  const matchedItem = (primaryGroup?.children || []).find((item) => item?.label === shell.sideNav)
    || groups.flatMap((group) => group?.children || []).find((item) => item?.label === shell.sideNav);
  if (matchedItem?.id) return String(matchedItem.id);
  if (shellConfig.activeTabId) return String(shellConfig.activeTabId);
  return shellConfig.tabs?.[0]?.id ? String(shellConfig.tabs[0].id) : '';
}

export function generatedPreviewApp(spec) {
  const serialized = JSON.stringify(spec, null, 2).replace(/<\//g, '<\\/');
  return `// Derived from page-spec.json. Do not edit.\n// page-spec-sha256: ${pageSpecHash(spec)}\ndocument.addEventListener('DOMContentLoaded', function () {\n  const spec = ${serialized};\n  const shellConfig = Object.assign({}, window.EASY_ACCOUNT_SHELL_CONFIG || {}, spec.shell || {});\n  const activeTabId = (${resolveShellActiveTabId.toString()})(spec.shell || {}, shellConfig);\n  const pageEntries = [{ tabId: activeTabId, spec: spec }].concat((spec.shell && spec.shell.pages || []).map(function (page) { return { tabId: page.tabId, spec: page.spec }; }));\n  const contentByTab = Object.assign({}, spec.shell && spec.shell.contentByTab || {});\n  const tabs = (shellConfig.tabs || []).map(function (tab) { return Object.assign({}, tab); });\n  pageEntries.forEach(function (page) {\n    page.root = document.createElement('div');\n    if (page.tabId) {\n      contentByTab[page.tabId] = page.root;\n      if (!tabs.some(function (tab) { return tab.id === page.tabId; })) {\n        tabs.push({ id: page.tabId, label: page.spec.metadata.pageName, closable: true });\n      }\n    }\n  });\n  const shell = window.EasyAccountShell.mount(Object.assign({}, shellConfig, { tabs: tabs, activeTabId: activeTabId, content: '', contentByTab: contentByTab }));\n  pageEntries.forEach(function (page) {\n    window.EasyAccountPageSpecRuntime.mount(page.spec, page.tabId ? page.root : shell.contentSlot);\n  });\n});\n`;
}

export function assertChangeSpecPath(root, specPath) {
  const absolute = resolve(root, specPath);
  const changesRoot = resolve(root, 'changes');
  if (!absolute.startsWith(`${changesRoot}/`) || basename(absolute) !== 'page-spec.json' || !existsSync(absolute)) {
    throw new Error('Page Spec must be an existing changes/{change-id}/page-spec.json file.');
  }
  return absolute;
}

export function changeDirFromSpec(specPath) { return dirname(specPath); }
