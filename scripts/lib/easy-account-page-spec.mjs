import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { assertRuleRefs, readDirectorRules, resolveDetailPresentation, resolveFormPresentation } from './easy-account-director-rules.mjs';
import { validateFormFields } from './easy-account-form-fields.mjs';

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

function validationIssue(errors, condition, message) { if (!condition) errors.push(message); }
function hasText(value) { return typeof value === 'string' && value.trim().length > 0; }

function interactiveFields(form) {
  const fields = Array.isArray(form?.fields) ? form.fields : Array.isArray(form?.groups)
    ? form.groups.flatMap((group) => group.fields || [])
    : Array.isArray(form?.steps) ? form.steps.flatMap((step) => step.fields || []) : [];
  return fields.filter((field) => field?.interactive !== false && field?.kind !== 'display');
}

function validateFieldCollection(errors, fields, location) {
  errors.push(...validateFormFields(fields, location));
}

function validateOpenFields(errors, spec) {
  validateFieldCollection(errors, spec.list?.query?.fields, 'list.query.fields');
  (spec.list?.table?.views || []).forEach((view, index) => validateFieldCollection(errors, view?.queryFields, `list.table.views[${index}].queryFields`));
  const primaryForm = spec.list?.table?.primaryAction?.form;
  validateFieldCollection(errors, primaryForm?.fields, 'list.table.primaryAction.form.fields');
  (primaryForm?.groups || []).forEach((group, index) => validateFieldCollection(errors, group?.fields, `list.table.primaryAction.form.groups[${index}].fields`));
  (spec.list?.table?.columns || []).flatMap((column) => column?.actions || []).forEach((action, index) => {
    validateFieldCollection(errors, action?.form?.fields, `list.table.actions[${index}].form.fields`);
    (action?.form?.groups || []).forEach((group, groupIndex) => validateFieldCollection(errors, group?.fields, `list.table.actions[${index}].form.groups[${groupIndex}].fields`));
  });
  validateFieldCollection(errors, spec.form?.fields, 'form.fields');
  (spec.form?.groups || []).forEach((group, index) => validateFieldCollection(errors, group?.fields, `form.groups[${index}].fields`));
  (spec.form?.steps || []).forEach((step, index) => validateFieldCollection(errors, step?.fields, `form.steps[${index}].fields`));
}

export function validatePageSpec(spec, root = process.cwd()) {
  const errors = [];
  const director = readDirectorRules(root);
  validationIssue(errors, spec && typeof spec === 'object' && !Array.isArray(spec), 'Page Spec must be an object.');
  if (!spec || typeof spec !== 'object') return { valid: false, errors, warnings: [], directorRules: director.runtimePolicy };
  validationIssue(errors, spec.schemaVersion === 1, 'schemaVersion must be 1 for a legacy Page Spec.');
  validationIssue(errors, spec.ui?.system === 'easy-account' && spec.ui?.runtime === 'easy-account-page-spec', 'Page Spec must use the Easy Account legacy runtime.');
  validationIssue(errors, typeof spec.metadata?.family === 'string', 'metadata.family is required.');
  validationIssue(errors, Array.isArray(spec.metadata?.ruleRefs) && spec.metadata.ruleRefs.length > 0, 'metadata.ruleRefs must be non-empty.');
  const unknown = assertRuleRefs(spec.metadata?.ruleRefs, director);
  if (unknown.length) errors.push(`metadata.ruleRefs contains unknown director rules: ${unknown.join(', ')}.`);
  validateOpenFields(errors, spec);
  const family = spec.metadata?.family;
  if (family === 'list') {
    const fields = spec.list?.query?.fields || [];
    validationIssue(errors, Array.isArray(fields) && fields.length > 0, 'list.query.fields must be a non-empty array.');
    if (spec.list?.query?.collapseThreshold !== undefined
      && spec.list.query.collapseThreshold !== director.runtimePolicy.query.collapseThreshold) {
      errors.push(`list.query.collapseThreshold must match the fixed director rule value ${director.runtimePolicy.query.collapseThreshold}.`);
    }
    if (fields.length > director.runtimePolicy.query.basicMaxFields && spec.content?.capabilities?.includes('query.basic')) {
      errors.push(`list.query.fields exceeds director rule maximum of ${director.runtimePolicy.query.basicMaxFields}.`);
    }
    const table = spec.list?.table;
    (table?.columns || []).forEach((column, index) => {
      if (column?.headerWrap !== undefined && !['wrap', 'nowrap'].includes(column.headerWrap)) {
        errors.push(`list.table.columns[${index}].headerWrap must be wrap or nowrap.`);
      }
    });
    const action = table?.primaryAction;
    if (action) {
      const count = interactiveFields(action.form).length;
      const expected = resolveFormPresentation(count, director.runtimePolicy);
      const presentation = action.presentation || 'modal';
      validationIssue(errors, hasText(action.label), 'list.table.primaryAction.label is required.');
      validationIssue(errors, action.form && typeof action.form === 'object' && !Array.isArray(action.form), 'list.table.primaryAction.form is required.');
      validationIssue(errors, ['modal', 'drawer', 'page'].includes(presentation), 'list.table.primaryAction.presentation is invalid.');
      if (['modal', 'drawer'].includes(presentation)) validationIssue(errors, hasText(action.form?.title), 'list.table.primaryAction.form.title is required for Modal and Drawer.');
      if (presentation !== expected && action.preserveStructure !== true && action.form?.preserveStructure !== true) {
        errors.push(`list.table.primaryAction.presentation ${presentation} conflicts with director rules; expected ${expected}.`);
      }
    }
    const rowActions = (table?.columns || []).flatMap((column) => column?.actions || []);
    rowActions.filter((rowAction) => rowAction?.type === 'edit').forEach((rowAction, index) => {
      validationIssue(errors, hasText(rowAction.label), `list.table edit action ${index + 1}.label is required.`);
      validationIssue(errors, rowAction.form && typeof rowAction.form === 'object' && !Array.isArray(rowAction.form), `list.table edit action ${index + 1}.form is required.`);
      validationIssue(errors, hasText(rowAction.form?.title), `list.table edit action ${index + 1}.form.title is required.`);
    });
    if (spec.list?.table?.drawerDetail) validationIssue(errors, resolveDetailPresentation(director.runtimePolicy) === 'drawer', 'list detail must use the director default Drawer.');
  } else if (family === 'form') {
    const count = interactiveFields(spec.form).length;
    const presentation = spec.form?.presentation || (count > director.runtimePolicy.formPresentation.drawerMaxFields ? 'page' : 'modal');
    const expected = resolveFormPresentation(count, director.runtimePolicy);
    if (presentation !== expected) errors.push(`form.presentation ${presentation} conflicts with director rules; expected ${expected}.`);
  } else if (family === 'detail') {
    validationIssue(errors, resolveDetailPresentation(director.runtimePolicy) === 'drawer' || spec.detail?.presentation === 'page', 'detail presentation must follow director rules.');
  } else {
    errors.push(`Unsupported page family: ${family || 'missing'}.`);
  }
  return { valid: errors.length === 0, errors, warnings: [], directorRules: director.runtimePolicy };
}

export function resolveShellActiveTabId(shell = {}, shellConfig = {}, fallbackId = '') {
  if (typeof shell.activeTabId === 'string' && shell.activeTabId.trim()) return shell.activeTabId;
  const groups = Array.isArray(shellConfig.menu) ? shellConfig.menu : [];
  const primaryGroup = groups.find((group) => group?.label === shell.primaryNav);
  const matchedItem = (primaryGroup?.children || []).find((item) => item?.label === shell.sideNav)
    || groups.flatMap((group) => group?.children || []).find((item) => item?.label === shell.sideNav);
  if (matchedItem?.id) return String(matchedItem.id);
  if (fallbackId) return String(fallbackId);
  if (shellConfig.activeTabId) return String(shellConfig.activeTabId);
  return shellConfig.tabs?.[0]?.id ? String(shellConfig.tabs[0].id) : '';
}

export function projectShellMenu(pageEntries = [], shellConfig = {}) {
  const catalog = Array.isArray(shellConfig.menuCatalog)
    ? shellConfig.menuCatalog
    : (Array.isArray(shellConfig.menu) ? shellConfig.menu : []);
  const groups = [];

  pageEntries.forEach((entry, index) => {
    if (!entry?.tabId) return;
    const navigation = entry.navigation || entry.spec?.shell || {};
    const sideLabel = navigation.sideNav || entry.spec?.metadata?.pageName || `页面 ${index + 1}`;
    const explicitPrimary = navigation.primaryNav;
    const catalogGroup = catalog.find((group) => group?.label === explicitPrimary)
      || (!explicitPrimary ? catalog.find((group) => (group?.children || []).some((item) => item?.label === sideLabel)) : undefined);
    const primaryLabel = explicitPrimary || catalogGroup?.label || '易账通';
    let group = groups.find((item) => item.label === primaryLabel);
    if (!group) {
      group = {
        id: String(catalogGroup?.id || navigation.primaryNavId || `generated-group-${groups.length + 1}`),
        label: primaryLabel,
        icon: navigation.primaryNavIcon || catalogGroup?.icon || 'AppstoreOutlined',
        open: true,
        children: []
      };
      groups.push(group);
    }
    const catalogItem = (catalogGroup?.children || []).find((item) => item?.label === sideLabel);
    if (!group.children.some((item) => String(item.id) === String(entry.tabId))) {
      group.children.push({
        ...(catalogItem || {}),
        id: String(entry.tabId),
        label: sideLabel,
        active: index === 0
      });
    }
  });

  return groups;
}

export function generatedPreviewApp(spec) {
  const serialized = JSON.stringify(spec, null, 2).replace(/<\//g, '<\\/');
  return `// Derived from page-spec.json. Do not edit.\n// page-spec-sha256: ${pageSpecHash(spec)}\ndocument.addEventListener('DOMContentLoaded', function () {\n  const spec = ${serialized};\n  const shellConfig = Object.assign({}, window.EASY_ACCOUNT_SHELL_CONFIG || {}, spec.shell || {});\n  const catalogConfig = Object.assign({}, shellConfig, { menu: shellConfig.menuCatalog || shellConfig.menu || [] });\n  const fallbackTabId = 'page-' + spec.metadata.changeId;\n  const activeTabId = (${resolveShellActiveTabId.toString()})(spec.shell || {}, catalogConfig, fallbackTabId);\n  const declaredPages = (spec.shell && Array.isArray(spec.shell.pages) ? spec.shell.pages : []).filter(function (page) {\n    return page && page.spec && page.spec.metadata && page.spec.ui && page.spec.content;\n  });\n  const pageEntries = [{ tabId: activeTabId, spec: spec, navigation: spec.shell || {} }].concat(declaredPages.map(function (page, index) {\n    const pageSpec = page.spec;\n    const navigation = Object.assign({}, pageSpec.shell || {}, page.navigation || {}, { primaryNav: page.primaryNav || (page.navigation && page.navigation.primaryNav) || (pageSpec.shell && pageSpec.shell.primaryNav), sideNav: page.sideNav || (page.navigation && page.navigation.sideNav) || (pageSpec.shell && pageSpec.shell.sideNav) });\n    const tabId = page.tabId || (${resolveShellActiveTabId.toString()})(navigation, catalogConfig, 'page-' + (pageSpec.metadata.changeId || (spec.metadata.changeId + '-' + (index + 2))));\n    return { tabId: tabId, spec: pageSpec, navigation: navigation };\n  }));\n  const contentByTab = {};\n  const tabs = pageEntries.filter(function (page) { return page.tabId; }).map(function (page, index) {\n    return { id: page.tabId, label: page.spec.metadata.pageName || page.navigation.sideNav || page.tabId, closable: index !== 0 };\n  });\n  const menu = (${projectShellMenu.toString()})(pageEntries, catalogConfig);\n  pageEntries.forEach(function (page) {\n    page.root = document.createElement('div');\n    if (page.tabId) contentByTab[page.tabId] = page.root;\n  });\n  const shell = window.EasyAccountShell.mount(Object.assign({}, shellConfig, { menu: menu, tabs: tabs, activeTabId: activeTabId, content: '', contentByTab: contentByTab }));\n  pageEntries.forEach(function (page) {\n    window.EasyAccountPageSpecRuntime.mount(page.spec, page.tabId ? page.root : shell.contentSlot);\n  });\n});\n`;
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
