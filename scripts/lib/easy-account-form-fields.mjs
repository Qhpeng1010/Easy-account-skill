const COMMON_CONTROLS = new Set([
  'input', 'textarea', 'number', 'select', 'cascader', 'radio', 'checkbox',
  'checkbox-group', 'switch', 'date', 'date-range', 'time', 'time-range',
  'tree', 'tree-select', 'upload', 'slider', 'rate', 'autocomplete', 'mentions',
  'display'
]);

function valueAt(values, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce((current, key) => current?.[key], values);
}

function same(left, right) {
  if (left === right) return true;
  if (left === undefined || left === null || right === undefined || right === null) return false;
  return String(left) === String(right);
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

export function conditionMatches(condition, values = {}) {
  if (!condition) return true;
  if (Array.isArray(condition)) return condition.every((item) => conditionMatches(item, values));
  if (Array.isArray(condition.all)) return condition.all.every((item) => conditionMatches(item, values));
  if (Array.isArray(condition.any)) return condition.any.some((item) => conditionMatches(item, values));
  if (condition.not) return !conditionMatches(condition.not, values);

  const current = valueAt(values, condition.field);
  const expected = condition.value !== undefined ? condition.value : condition.values;
  switch (condition.operator || 'equals') {
    case 'notEquals': return !same(current, expected);
    case 'in': return asArray(expected).some((item) => same(current, item));
    case 'notIn': return !asArray(expected).some((item) => same(current, item));
    case 'includes': return asArray(current).some((item) => same(item, expected));
    case 'includesAny': return asArray(expected).some((item) => asArray(current).some((entry) => same(entry, item)));
    case 'includesAll': return asArray(expected).every((item) => asArray(current).some((entry) => same(entry, item)));
    case 'empty': return current === undefined || current === null || current === '' || (Array.isArray(current) && current.length === 0);
    case 'notEmpty': return !(current === undefined || current === null || current === '' || (Array.isArray(current) && current.length === 0));
    case 'truthy': return Boolean(current);
    case 'falsy': return !current;
    case 'equals':
    default: return same(current, expected);
  }
}

export function resolveFieldOptions(field, values = {}) {
  const source = field?.optionsBy;
  if (!source) return field?.options || [];
  const current = valueAt(values, source.field);
  const key = Array.isArray(current) ? current.join('|') : String(current ?? '');
  return source.map?.[key] || source.fallback || field.options || [];
}

export function fieldIsVisible(field, values = {}) {
  return conditionMatches(field?.visibleWhen, values);
}

export function fieldIsDisabled(field, values = {}) {
  return Boolean(field?.disabled || field?.props?.disabled || (field?.disabledWhen && conditionMatches(field.disabledWhen, values)));
}

export function fieldIsRequired(field, values = {}) {
  if (fieldIsDisabled(field, values)) return false;
  return Boolean(field?.required || (field?.requiredWhen && conditionMatches(field.requiredWhen, values)));
}

function validateCondition(condition, location, errors) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    errors.push(`${location} must be a condition object.`);
    return;
  }
  if (condition.all !== undefined || condition.any !== undefined) {
    const key = condition.all !== undefined ? 'all' : 'any';
    if (!Array.isArray(condition[key]) || condition[key].length === 0) errors.push(`${location}.${key} must be a non-empty array.`);
    else condition[key].forEach((item, index) => validateCondition(item, `${location}.${key}[${index}]`, errors));
    return;
  }
  if (condition.not !== undefined) {
    validateCondition(condition.not, `${location}.not`, errors);
    return;
  }
  if (typeof condition.field !== 'string' || !condition.field.trim()) errors.push(`${location}.field is required.`);
  const operators = ['equals', 'notEquals', 'in', 'notIn', 'includes', 'includesAny', 'includesAll', 'empty', 'notEmpty', 'truthy', 'falsy'];
  if (condition.operator !== undefined && !operators.includes(condition.operator)) errors.push(`${location}.operator is unsupported.`);
}

export function validateFormFields(fields, location = 'fields') {
  const errors = [];
  if (!Array.isArray(fields)) return errors;
  const keys = fields.map((field) => field?.key).filter(Boolean);
  if (new Set(keys).size !== keys.length) errors.push(`${location} field keys must be unique.`);
  fields.forEach((field, index) => {
    const current = `${location}[${index}]`;
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      errors.push(`${current} must be an object.`);
      return;
    }
    if (typeof field.key !== 'string' || !field.key.trim()) errors.push(`${current}.key is required.`);
    if (typeof field.label !== 'string' || !field.label.trim()) errors.push(`${current}.label is required.`);
    const hasControl = typeof field.control === 'string' && field.control.trim();
    const hasComponent = typeof field.component === 'string' && field.component.trim();
    if (!hasControl && !hasComponent) errors.push(`${current} requires control or component.`);
    if (hasControl && !COMMON_CONTROLS.has(field.control) && !hasComponent) {
      errors.push(`${current}.control ${field.control} is not built in; declare the Ant Design component name with component.`);
    }
    if (field.mode !== undefined && !['multiple', 'tags'].includes(field.mode)) errors.push(`${current}.mode must be multiple or tags.`);
    if (field.props !== undefined && (!field.props || typeof field.props !== 'object' || Array.isArray(field.props))) errors.push(`${current}.props must be an object.`);
    if (field.optionsBy !== undefined) {
      if (!field.optionsBy || typeof field.optionsBy !== 'object' || Array.isArray(field.optionsBy)) errors.push(`${current}.optionsBy must be an object.`);
      else {
        if (typeof field.optionsBy.field !== 'string' || !field.optionsBy.field.trim()) errors.push(`${current}.optionsBy.field is required.`);
        if (!field.optionsBy.map || typeof field.optionsBy.map !== 'object' || Array.isArray(field.optionsBy.map)) errors.push(`${current}.optionsBy.map is required.`);
      }
    }
    ['visibleWhen', 'disabledWhen', 'requiredWhen'].forEach((key) => {
      if (field[key] !== undefined) validateCondition(field[key], `${current}.${key}`, errors);
    });
  });
  return errors;
}
