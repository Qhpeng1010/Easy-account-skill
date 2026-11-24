(function () {
  'use strict';

  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const antd = window.antd;
  const icons = window.icons || window.antdIcons || window.AntDesignIcons || {};
  if (!React || !ReactDOM || !antd) throw new Error('EasyAccountPageSpecRuntime requires React, ReactDOM and Ant Design.');

  const h = React.createElement;
  const {
    Button,
    Checkbox,
    ConfigProvider,
    DatePicker,
    Descriptions,
    Drawer,
    Empty,
    Form,
    Input,
    Modal,
    Pagination,
    Popover,
    Radio,
    Select,
    Space,
    Switch,
    Table,
    Tag,
    Tabs,
    Tooltip,
    Tree,
    Upload,
    message
  } = antd;
  const { ArrowLeftOutlined, CloseOutlined, DownloadOutlined, DownOutlined, SettingOutlined, UpOutlined, UploadOutlined } = icons;

  function amount(value, showCurrency = true) {
    const data = value && typeof value === 'object' ? value : { minor: String(value || '0'), currency: 'CNY' };
    const minor = String(data.minor || '0');
    const negative = minor.startsWith('-');
    const digits = (negative ? minor.slice(1) : minor).padStart(3, '0');
    const major = `${digits.slice(0, -2)}.${digits.slice(-2)}`.replace(/^0+(?=\d)/, '');
    const formatted = `${negative ? '-' : ''}${major}`;
    return showCurrency
      ? h(Space, { size: 4 }, formatted, h('span', { className: 'ea-ant-currency' }, data.currency || 'CNY'))
      : formatted;
  }

  function amountColumnTitle(column) {
    const label = String(column.label || '金额');
    if (column.mixedCurrency === true) return label;
    const unit = column.unit || ({ CNY: '元', USD: '美元', EUR: '欧元' }[column.currency] || column.currency || '元');
    if (label.endsWith(`(${unit})`)) return label;
    if (label.endsWith(`（${unit}）`)) return `${label.slice(0, -(unit.length + 2))}(${unit})`;
    return `${label}(${unit})`;
  }

  function status(value) {
    const item = value && typeof value === 'object' ? value : { text: String(value || '-'), tone: 'default' };
    const colors = {
      default: 'default',
      error: 'error',
      processing: 'processing',
      success: 'success',
      warning: 'warning'
    };
    return h(Tag, { color: colors[item.tone] || 'default', className: 'ea-status-tag' }, item.text || '-');
  }

  function stackCell(column, row) {
    return h('div', { className: 'ea-stacked-cell' }, ...(column.lines || []).map((line, index) => {
      const value = row[line.source] ?? '-';
      const content = line.prefix ? `${line.prefix}${value}` : String(value);
      return index === 0
        ? h('strong', { key: line.source, title: content }, content)
        : h('span', { key: line.source, title: content }, content);
    }));
  }

  function stackHeader(column) {
    const label = String(column.label || '');
    const parts = label.split(/[\/／]/).map((part) => part.trim()).filter(Boolean);
    if (column.headerWrap !== 'wrap' || parts.length < 2) {
      return h('span', { className: 'ea-stacked-header ea-stacked-header--nowrap' }, label);
    }
    return h('div', { className: 'ea-stacked-header' }, ...parts.map((part, index) => h('span', { key: `${part}-${index}` }, part)));
  }

  function fieldValue(values, path) {
    return String(path || '').split('.').filter(Boolean).reduce((current, key) => current?.[key], values);
  }

  function sameValue(left, right) {
    if (left === right) return true;
    if (left === undefined || left === null || right === undefined || right === null) return false;
    return String(left) === String(right);
  }

  function conditionMatches(condition, values) {
    if (!condition) return true;
    if (Array.isArray(condition)) return condition.every((item) => conditionMatches(item, values));
    if (Array.isArray(condition.all)) return condition.all.every((item) => conditionMatches(item, values));
    if (Array.isArray(condition.any)) return condition.any.some((item) => conditionMatches(item, values));
    if (condition.not) return !conditionMatches(condition.not, values);
    const current = fieldValue(values, condition.field);
    const expected = condition.value !== undefined ? condition.value : condition.values;
    const list = (value) => Array.isArray(value) ? value : [value];
    switch (condition.operator || 'equals') {
      case 'notEquals': return !sameValue(current, expected);
      case 'in': return list(expected).some((item) => sameValue(current, item));
      case 'notIn': return !list(expected).some((item) => sameValue(current, item));
      case 'includes': return list(current).some((item) => sameValue(item, expected));
      case 'includesAny': return list(expected).some((item) => list(current).some((entry) => sameValue(entry, item)));
      case 'includesAll': return list(expected).every((item) => list(current).some((entry) => sameValue(entry, item)));
      case 'empty': return current === undefined || current === null || current === '' || (Array.isArray(current) && current.length === 0);
      case 'notEmpty': return !(current === undefined || current === null || current === '' || (Array.isArray(current) && current.length === 0));
      case 'truthy': return Boolean(current);
      case 'falsy': return !current;
      default: return sameValue(current, expected);
    }
  }

  function fieldOptions(field, values) {
    if (!field.optionsBy) return field.options || [];
    const source = fieldValue(values, field.optionsBy.field);
    const key = Array.isArray(source) ? source.join('|') : String(source ?? '');
    return field.optionsBy.map?.[key] || field.optionsBy.fallback || field.options || [];
  }

  function resolveComponent(name) {
    return String(name || '').split('.').filter(Boolean).reduce((current, key) => current?.[key], antd);
  }

  function control(field, id, values = {}) {
    const placeholder = field.placeholder || field.props?.placeholder || (['select', 'cascader', 'tree-select', 'date', 'date-range', 'time', 'time-range'].includes(field.control) ? `请选择${field.label}` : `请输入${field.label}`);
    const disabled = Boolean(field.disabled || field.props?.disabled || (field.disabledWhen && conditionMatches(field.disabledWhen, values)));
    const options = fieldOptions(field, values);
    const common = { ...(field.props || {}), id, placeholder, disabled, maxLength: field.maxLength ?? field.props?.maxLength };
    if (field.control === 'select') return h(Select, { ...common, allowClear: field.allowClear !== false, mode: field.mode || (field.multiple ? 'multiple' : common.mode), options });
    if (field.control === 'cascader') return h(antd.Cascader, { ...common, allowClear: field.allowClear !== false, multiple: field.multiple ?? common.multiple, options });
    if (field.control === 'radio') return h(Radio.Group, { ...common, options });
    if (field.control === 'checkbox-group') return h(Checkbox.Group, { ...common, options });
    if (field.control === 'checkbox') return h(Checkbox, common, field.text || field.checkboxLabel || null);
    if (field.control === 'switch') return h(Switch, { ...common, checkedChildren: field.checkedLabel, unCheckedChildren: field.uncheckedLabel });
    if (field.control === 'tree-select') return h(antd.TreeSelect, { ...common, allowClear: field.allowClear !== false, multiple: field.multiple ?? common.multiple, treeCheckable: field.treeCheckable ?? common.treeCheckable, treeData: field.treeData || options });
    if (field.control === 'tree') return h(Tree, {
      id,
      className: 'ea-permission-tree',
      checkable: true,
      selectable: false,
      defaultExpandAll: field.defaultExpandAll !== false,
      disabled,
      treeData: field.treeData || []
    });
    if (field.control === 'upload') return h(Upload, {
      ...(field.props || {}),
      id,
      accept: field.accept || 'image/*',
      beforeUpload: () => false,
      maxCount: field.maxCount || field.props?.maxCount || 1,
      listType: field.listType || 'picture'
    }, h(Button, { icon: UploadOutlined ? h(UploadOutlined) : null, className: 'ea-upload-trigger' }, field.buttonLabel || '上传文件'));
    if (field.control === 'date') return h(DatePicker, { ...common, format: field.format || common.format || 'YYYY-MM-DD', style: { width: '100%', ...(field.props?.style || {}) } });
    if (field.control === 'date-range') return h(DatePicker.RangePicker, { ...common, format: field.format || common.format || 'YYYY-MM-DD', style: { width: '100%', ...(field.props?.style || {}) } });
    if (field.control === 'time') return h(antd.TimePicker, { ...common, format: field.format || common.format || 'HH:mm', style: { width: '100%', ...(field.props?.style || {}) } });
    if (field.control === 'time-range') return h(antd.TimePicker.RangePicker, { ...common, format: field.format || common.format || 'HH:mm', style: { width: '100%', ...(field.props?.style || {}) } });
    if (field.control === 'textarea') return h(Input.TextArea, { ...common, rows: field.rows || common.rows || 3, showCount: field.showCount ?? Boolean(field.maxLength ?? common.maxLength) });
    if (field.control === 'number') return h(antd.InputNumber, { ...common, min: field.min ?? common.min, max: field.max ?? common.max, precision: field.precision ?? common.precision, style: { width: '100%', ...(field.props?.style || {}) } });
    if (field.control === 'slider') return h(antd.Slider, { ...common, min: field.min ?? common.min, max: field.max ?? common.max, step: field.step ?? common.step });
    if (field.control === 'rate') return h(antd.Rate, common);
    if (field.control === 'autocomplete') return h(antd.AutoComplete, { ...common, options });
    if (field.control === 'mentions') return h(antd.Mentions, { ...common, options });
    const Component = field.component ? resolveComponent(field.component) : Input;
    return h(Component || Input, { ...common, options });
  }

  function fieldBinding(field) {
    if (field.control === 'tree') return { valuePropName: 'checkedKeys', trigger: 'onCheck' };
    if (field.control === 'checkbox' || field.control === 'switch') return { valuePropName: 'checked' };
    if (field.control === 'upload') return { valuePropName: 'fileList', getValueFromEvent: (event) => Array.isArray(event) ? event : event?.fileList };
    return {};
  }

  function resolveByField(spec, values) {
    if (!spec || !spec.field) return null;
    const current = fieldValue(values, spec.field);
    return spec.map?.[String(current)] ?? spec.fallback ?? null;
  }

  function renderDisplayField(field, sourceRow, itemProps = {}) {
    const lineValue = (part) => {
      if (part && typeof part === 'object' && 'source' in part) return String(sourceRow?.[part.source] ?? '-');
      if (part && typeof part === 'object') return String(part.text ?? '-');
      return String(part ?? '-');
    };
    const lines = Array.isArray(field.lines) ? field.lines.map(lineValue) : null;
    return h(Form.Item, { ...itemProps, key: field.key, label: field.label },
      h('div', {
        className: 'ea-display-value',
        style: {
          padding: '4px 12px',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          background: '#fafafa',
          minHeight: 32,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          wordBreak: 'break-all'
        }
      },
      lines
        ? lines.map((line, index) => h('div', {
            key: index,
            style: index === 0
              ? { fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }
              : { fontSize: 12, color: 'rgba(0, 0, 0, 0.45)' }
          }, line))
        : (field.text || '-')));
  }

  function renderField(form, field, id, itemProps = {}, sourceRow = null) {
    return h(Form.Item, { key: `watch-${field.key}`, noStyle: true, shouldUpdate: true }, () => {
      const values = form.getFieldsValue(true);
      if (field.visibleWhen && !conditionMatches(field.visibleWhen, values)) return null;
      if (field.kind === 'display' || field.control === 'display') return renderDisplayField(field, sourceRow, itemProps);
      return h(Form.Item, {
        ...itemProps,
        ...fieldBinding(field),
        key: field.key,
        label: resolveByField(field.labelBy, values) || field.label,
        name: field.key,
        preserve: field.preserve !== false,
        rules: formRules(field, values)
      }, control(field, id, values));
    });
  }

  function normalizeDependentFields(form, fields, values) {
    const resets = {};
    (fields || []).forEach((field) => {
      const current = values[field.key];
      if (field.visibleWhen && !conditionMatches(field.visibleWhen, values) && field.preserveWhenHidden !== true && current !== undefined) resets[field.key] = undefined;
      if (field.optionsBy && field.resetWhenDependenciesChange !== false && current !== undefined) {
        const allowed = fieldOptions(field, values).map((option) => option?.value);
        const selected = Array.isArray(current) ? current : [current];
        if (selected.some((value) => !allowed.some((item) => sameValue(item, value)))) resets[field.key] = undefined;
      }
    });
    if (Object.keys(resets).length) form.setFieldsValue(resets);
  }

  function matches(row, fields, filters) {
    return fields.every((field) => {
      const value = filters[field.key];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return true;
      const source = row[field.filterKey || field.key];
      const sourceValue = source && typeof source === 'object' ? source.value ?? source.text ?? source.minor : source;
      if (['select', 'cascader', 'checkbox-group', 'tree-select'].includes(field.control) && Array.isArray(value)) {
        const expected = field.control === 'cascader' && !field.multiple ? value.slice(-1) : value;
        const actual = Array.isArray(sourceValue) ? sourceValue : [sourceValue];
        return field.filterMode === 'all'
          ? expected.every((item) => actual.some((entry) => sameValue(entry, item)))
          : expected.some((item) => actual.some((entry) => sameValue(entry, item)));
      }
      if (field.control === 'select') return sameValue(sourceValue, value);
      if (field.control === 'date-range' && Array.isArray(value) && value.length === 2) {
        const start = value[0]?.format?.('YYYY-MM-DD');
        const end = value[1]?.format?.('YYYY-MM-DD');
        const date = String(sourceValue || '').slice(0, 10);
        return (!start || date >= start) && (!end || date <= end);
      }
      return String(sourceValue || '').toLowerCase().includes(String(value).toLowerCase());
    });
  }

  function valueForCondition(value) {
    if (value && typeof value === 'object') return value.value ?? value.text;
    return value;
  }

  function actionVisible(action, row) {
    const condition = action.visibleWhen;
    if (!condition) return true;
    const current = valueForCondition(row[condition.field]);
    if (Array.isArray(condition.values)) return condition.values.map(String).includes(String(current));
    return String(current) === String(condition.value);
  }

  function csvCell(value, column) {
    let output = value;
    if (column.format === 'amount') output = amountText(value, column.mixedCurrency === true);
    else if (value && typeof value === 'object') output = value.text ?? value.value ?? '';
    else if (Array.isArray(value)) output = value.join('、');
    return `"${String(output ?? '').replaceAll('"', '""')}"`;
  }

  function amountText(value, showCurrency) {
    const data = value && typeof value === 'object' ? value : { minor: String(value || '0'), currency: 'CNY' };
    const minor = String(data.minor || '0');
    const negative = minor.startsWith('-');
    const digits = (negative ? minor.slice(1) : minor).padStart(3, '0');
    const major = `${digits.slice(0, -2)}.${digits.slice(-2)}`.replace(/^0+(?=\d)/, '');
    return `${negative ? '-' : ''}${major}${showCurrency ? ` ${data.currency || 'CNY'}` : ''}`;
  }

  function localDateTime() {
    const value = new Date();
    const part = (number) => String(number).padStart(2, '0');
    return `${value.getFullYear()}-${part(value.getMonth() + 1)}-${part(value.getDate())} ${part(value.getHours())}:${part(value.getMinutes())}:${part(value.getSeconds())}`;
  }

  function formRules(field, values = {}) {
    const rules = [];
    const disabled = field.disabled || field.props?.disabled || (field.disabledWhen && conditionMatches(field.disabledWhen, values));
    const required = !disabled && (field.required || (field.requiredWhen && conditionMatches(field.requiredWhen, values)));
    if (required) rules.push({ required: true, message: field.validationMessage || `请填写${field.label}` });
    if (field.validationPattern) rules.push({ pattern: new RegExp(field.validationPattern), message: field.patternMessage || `${field.label}格式不正确` });
    return rules;
  }

  function interactiveFormFieldCount(form) {
    const fields = Array.isArray(form?.fields) ? form.fields : Array.isArray(form?.groups)
      ? form.groups.flatMap((group) => group.fields || [])
      : Array.isArray(form?.steps) ? form.steps.flatMap((step) => step.fields || []) : [];
    return fields.filter((field) => field?.interactive !== false && field?.kind !== 'display').length;
  }

  function directorFormPresentation(spec, form, declared) {
    if (declared) return declared;
    const policy = spec.directorPolicy;
    if (!policy) return 'modal';
    const thresholds = policy.thresholds || policy.formPresentation;
    const count = interactiveFormFieldCount(form);
    if (count > Number(thresholds?.drawerMaxFields)) return 'page';
    if (count > Number(thresholds?.modalMaxFields)) return 'drawer';
    return 'modal';
  }

  function detailValue(field, row) {
    if (field.format === 'amount') return amount(row[field.source]);
    if (field.format === 'status') return status(row[field.source]);
    if (Array.isArray(row[field.source])) return row[field.source].join('、') || '-';
    return row[field.source] || '-';
  }

  function decimalToAmount(value, currency) {
    const source = String(value ?? '').trim();
    const matched = source.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
    if (!matched) return { minor: '0', currency: currency || 'CNY' };
    const digits = `${matched[2]}${(matched[3] || '').padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
    return { minor: `${matched[1]}${digits || '0'}`, currency: currency || 'CNY' };
  }

  function normalizeRecord(values, defaults, table) {
    const record = { ...(defaults || {}), ...(values || {}) };
    Object.keys(record).forEach((key) => {
      const value = record[key];
      if (value && typeof value.format === 'function') record[key] = value.format('YYYY-MM-DD');
      if (Array.isArray(value) && value.every((item) => item && typeof item.format === 'function')) {
        record[key] = value.map((item) => item.format('YYYY-MM-DD')).join(' - ');
      }
    });
    (table.columns || []).forEach((column) => {
      if (column.format === 'amount' && record[column.key] !== undefined && typeof record[column.key] !== 'object') {
        record[column.key] = decimalToAmount(record[column.key], column.currency);
      }
    });
    return record;
  }

  function applyDisplayValues(record, fields) {
    (fields || []).forEach((field) => {
      if (!field.displayKey || !Array.isArray(field.options)) return;
      if (Array.isArray(record[field.key])) {
        record[field.displayKey] = record[field.key].map((value) => field.options.find((item) => sameValue(item.value, value))?.label || value).join('、');
        return;
      }
      const option = field.options.find((item) => String(item.value) === String(record[field.key]));
      if (option) record[field.displayKey] = option.label;
    });
    return record;
  }

  function listTitle(table) {
    return table.sectionTitle || '查询列表';
  }

  function ListPage({ spec }) {
    const table = spec.list.table;
    const baseFields = spec.list.query.fields || [];
    const views = table.views || [];
    const primaryAction = table.primaryAction;
    const createConfig = primaryAction?.form;
    const primaryPresentation = directorFormPresentation(spec, createConfig, primaryAction?.presentation);
    const [queryForm] = Form.useForm();
    const [createForm] = Form.useForm();
    const [confirmForm] = Form.useForm();
    const [allRows, setAllRows] = React.useState(table.rows || []);
    const [filters, setFilters] = React.useState({});
    const [loading, setLoading] = React.useState(false);
    const [failure, setFailure] = React.useState('');
    const [denied, setDenied] = React.useState(false);
    const [collapsed, setCollapsed] = React.useState(false);
    const [page, setPage] = React.useState(table.pagination?.page || 1);
    const [pageSize, setPageSize] = React.useState(table.pagination?.pageSize || 10);
    const [visibleKeys, setVisibleKeys] = React.useState(() => table.columns.filter((column) => column.hidden !== true).map((column) => column.key));
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [detailRow, setDetailRow] = React.useState(null);
    const [detailPageRow, setDetailPageRow] = React.useState(null);
    const [detailPageTab, setDetailPageTab] = React.useState('');
    const [createOpen, setCreateOpen] = React.useState(false);
    const [rowModalAction, setRowModalAction] = React.useState(null);
    const [view, setView] = React.useState('list');
    const [activeView, setActiveView] = React.useState(views[0]?.key);
    const [rowPageAction, setRowPageAction] = React.useState(null);
    const [dirty, setDirty] = React.useState(false);
    const [creating, setCreating] = React.useState(false);
    const [confirming, setConfirming] = React.useState(false);
    const [confirmedAction, setConfirmedAction] = React.useState(null);
    const selectedView = views.find((item) => item.key === activeView);
    const modalFormConfig = rowModalAction?.form || createConfig;
    const modalSubmit = modalFormConfig?.submit || modalFormConfig || {};
    const modalTitle = modalFormConfig?.title || rowModalAction?.label || primaryAction?.label || '操作';
    const fields = selectedView?.queryFields || baseFields;
    const queryTabs = views.some((item) => Array.isArray(item.queryFields));
    const collapseThreshold = spec.directorPolicy?.query?.collapseThreshold || 3;
    const supportsCollapse = fields.length > collapseThreshold;
    const visibleFields = collapsed ? fields.slice(0, collapseThreshold) : fields;
    const viewRows = React.useMemo(() => {
      const viewFilter = selectedView?.filter || {};
      return allRows.filter((row) => Object.entries(viewFilter).every(([key, value]) => String(row[key]) === String(value)));
    }, [allRows, selectedView]);
    const matchedRows = React.useMemo(() => viewRows.filter((row) => matches(row, fields, filters)), [viewRows, fields, filters]);
    const pagedRows = matchedRows.slice((page - 1) * pageSize, page * pageSize);

    const runQuery = (values) => {
      setLoading(true);
      setFailure('');
      setDenied(false);
      setPage(1);
      window.setTimeout(() => {
        const valuesList = Object.values(values || {}).map((value) => String(value || '').trim().toUpperCase());
        if (valuesList.includes('ERROR')) {
          setFailure('服务暂时不可用，请稍后重试。');
          setLoading(false);
          return;
        }
        if (valuesList.includes('DENIED')) {
          setDenied(true);
          setLoading(false);
          return;
        }
        setFilters(values || {});
        setLoading(false);
      }, 220);
    };

    const reset = () => {
      queryForm.resetFields();
      setFilters({});
      setFailure('');
      setDenied(false);
      setPage(1);
    };

    const changeView = (key) => {
      if (queryTabs) {
        queryForm.resetFields();
        setFilters({});
        setFailure('');
        setDenied(false);
        setCollapsed(false);
      }
      setActiveView(key);
      setPage(1);
    };

    const closeCreate = () => {
      createForm.resetFields();
      setDirty(false);
      setCreating(false);
      setCreateOpen(false);
      setRowModalAction(null);
      setRowPageAction(null);
      setView('list');
    };

    const requestLeaveCreate = () => {
      if (!dirty) {
        closeCreate();
        return;
      }
      Modal.confirm({
        title: '放弃未保存修改？',
        content: '返回后当前填写内容将不会保留。',
        okText: '放弃并返回',
        cancelText: '继续编辑',
        centered: true,
        onOk: closeCreate
      });
    };

    const createRecord = (values) => {
      const rowKey = table.rowKey;
      if (String(values.projectName || '').trim().toUpperCase() === 'ERROR') {
        createForm.setFields([{ name: 'projectName', errors: ['项目名称校验失败，请更换后重试'] }]);
        return;
      }
      if (!rowModalAction && values[rowKey] && allRows.some((row) => String(row[rowKey]) === String(values[rowKey]))) {
        const keyLabel = (createConfig?.groups || []).flatMap((group) => group.fields || []).find((field) => field.key === rowKey)?.label || rowKey;
        createForm.setFields([{ name: rowKey, errors: [`${keyLabel}已存在，请重新输入`] }]);
        return;
      }
      setCreating(true);
      window.setTimeout(() => {
        if (rowModalAction) {
          const record = applyDisplayValues(normalizeRecord(values, rowModalAction.row, table), rowModalAction.form?.fields);
          setAllRows((current) => current.map((row) => row[rowKey] === rowModalAction.row[rowKey] ? record : row));
        } else {
          const record = applyDisplayValues(normalizeRecord(values, createConfig?.recordDefaults, table), createConfig?.fields);
          if (!record[rowKey] && createConfig?.autoIdPrefix) {
            const nextId = Number(createConfig.autoIdStart || 0) + allRows.length + 1;
            record[rowKey] = `${createConfig.autoIdPrefix}${String(nextId).padStart(5, '0')}`;
          }
          setAllRows((current) => [record, ...current]);
        }
        setPage(1);
        setCreating(false);
        setDirty(false);
        setCreateOpen(false);
        setRowModalAction(null);
        setView('list');
        createForm.resetFields();
        message.success(modalSubmit.successMessage || (rowModalAction ? '编辑成功' : '新增成功'));
      }, 320);
    };

    const submitRowPageAction = () => {
      const submit = rowPageAction?.form?.submit || {};
      setCreating(true);
      window.setTimeout(() => {
        setCreating(false);
        setDirty(false);
        setRowPageAction(null);
        setView('list');
        createForm.resetFields();
        message.success(submit.successMessage || '提交成功');
      }, 320);
    };

    const onCreateFailed = ({ errorFields }) => {
      const first = errorFields?.[0]?.name?.[0];
      if (!first) return;
      createForm.scrollToField(first, { behavior: 'smooth', block: 'center' });
      window.setTimeout(() => document.getElementById(`form-${first}`)?.focus(), 180);
    };

    const openCreate = () => {
      setDirty(false);
      setRowModalAction(null);
      createForm.resetFields();
      if (primaryPresentation === 'page') setView('create');
      else setCreateOpen(true);
    };

    const handleRowAction = (action, row) => {
      if (action.type === 'page-detail') {
        const config = table.pageDetail || {};
        setDetailPageRow(row);
        setDetailPageTab((config.tabs || [])[0]?.key || '');
        setView('page-detail');
        return;
      }
      if (action.type === 'detail') {
        setDetailRow(row);
        return;
      }
      if (action.type === 'page-form') {
        createForm.resetFields();
        setDirty(false);
        setRowPageAction({ ...action, row });
        setView('row-page-form');
        return;
      }
      if (action.type === 'delete') {
        Modal.confirm({
          title: '删除账号？',
          content: `确认删除账号“${row.accountName || row[rowKey]}”？删除后无法恢复。`,
          okText: '确认删除',
          cancelText: '取消',
          centered: true,
          onOk: () => {
            setAllRows((current) => current.filter((item) => item[rowKey] !== row[rowKey]));
            setPage(1);
            message.success('账号已删除');
          }
        });
        return;
      }
      if (action.type === 'edit' && action.form) {
        createForm.resetFields();
        createForm.setFieldsValue(row);
        setDirty(false);
        setRowModalAction({ ...action, row });
        setCreateOpen(true);
        return;
      }
      if (action.type === 'confirm-status') {
        confirmForm.resetFields();
        setConfirmedAction({ action, row });
        return;
      }
      message.info(`${action.label}已触发`);
    };

    const closeConfirmedAction = () => {
      if (confirming) return;
      confirmForm.resetFields();
      setConfirmedAction(null);
    };

    const submitConfirmedAction = (values) => {
      const context = confirmedAction;
      if (!context) return;
      const { action, row } = context;
      const config = action.confirm || {};
      const nextValue = action.nextValue;
      setConfirming(true);
      window.setTimeout(() => {
        setAllRows((current) => current.map((item) => item[table.rowKey] === row[table.rowKey]
          ? {
              ...item,
              [action.statusField || 'status']: nextValue,
              [action.updatedTimeField || 'updateTime']: localDateTime(),
              lastOperationReason: values.reason
            }
          : item));
        setConfirming(false);
        setConfirmedAction(null);
        confirmForm.resetFields();
        message.success(config.successMessage || `${action.label}成功`);
      }, 320);
    };

    const exportRows = (action) => {
      const exportColumns = table.columns.filter((column) => column.key !== 'actions' && column.exportable !== false);
      const content = [
        exportColumns.map((column) => csvCell(column.format === 'amount' ? amountColumnTitle(column) : column.label, {})).join(','),
        ...matchedRows.map((row) => exportColumns.map((column) => csvCell(row[column.key], column)).join(','))
      ].join('\n');
      const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = action.fileName || `${spec.metadata.pageName || '查询列表'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${matchedRows.length} 条记录`);
    };

    const toggleStatus = (column, row, checked) => {
      const rowKey = table.rowKey;
      const nextValue = {
        value: checked ? (column.checkedValue || 'enabled') : (column.uncheckedValue || 'disabled'),
        text: checked ? (column.checkedText || '启用') : (column.uncheckedText || '禁用')
      };
      setAllRows((current) => current.map((item) => item[rowKey] === row[rowKey]
        ? { ...item, [column.key]: nextValue }
        : item));
      message.success(`${row.roleName || row[rowKey]}已${nextValue.text}`);
    };

    const columnSettings = h('div', { className: 'ea-column-settings' },
      h('strong', null, '列设置'),
      ...table.columns.filter((column) => column.key !== 'actions' && column.hideable !== false).map((column) => h(Checkbox, {
        key: column.key,
        checked: visibleKeys.includes(column.key),
        onChange: (event) => setVisibleKeys((current) => event.target.checked ? [...new Set([...current, column.key])] : current.filter((key) => key !== column.key))
      }, column.label)));

    const dataColumns = table.columns
      .filter((column) => visibleKeys.includes(column.key) && (!denied || column.key !== 'actions'))
      .map((column) => {
        if (column.key === 'actions') return {
          key: column.key,
          title: column.label,
          width: column.width,
          className: 'ea-action-column',
          onCell: () => ({ className: 'ea-action-column' }),
          fixed: 'right',
          render: (_, row) => h(Space, { size: 12 }, ...(column.actions || []).filter((action) => actionVisible(action, row)).map((action) => h(Button, {
            key: action.key,
            type: 'link',
            size: 'small',
            disabled: loading || confirming,
            onClick: () => handleRowAction(action, row)
          }, action.label)))
        };
        const isStack = column.format === 'stack';
        const hasMultiFieldHeader = /[\/／]/.test(String(column.label || ''));
        return {
          key: column.key,
          dataIndex: column.key,
          title: column.format === 'amount' ? amountColumnTitle(column) : (isStack || hasMultiFieldHeader || column.headerWrap === 'nowrap') ? stackHeader(column) : column.label,
          width: column.width,
          ellipsis: false,
          align: column.format === 'amount' ? 'right' : undefined,
          className: column.format === 'amount' ? 'ea-amount-column' : isStack ? 'ea-stacked-group-column' : undefined,
          render: column.format === 'amount'
            ? (value) => amount(value, column.mixedCurrency === true)
            : column.format === 'status'
              ? status
              : column.format === 'switch'
                ? (value, row) => {
                    const item = value && typeof value === 'object' ? value : { value, text: value ? '启用' : '禁用' };
                    const checked = item.value === (column.checkedValue || 'enabled') || item.value === true;
                    return h(Space, { size: 8, className: 'ea-status-switch' },
                      h(Switch, {
                        size: 'small',
                        checked,
                        'aria-label': `${row.roleName || '当前角色'}状态：${item.text || (checked ? '启用' : '禁用')}`,
                        onChange: (nextChecked) => toggleStatus(column, row, nextChecked)
                      }),
                      h('span', null, item.text || (checked ? '启用' : '禁用')));
                  }
              : column.format === 'stack'
                ? (_, row) => stackCell(column, row)
                : undefined
        };
      });

    const emptyText = failure
      ? h('div', { className: 'ea-table-state' }, h('strong', null, '查询失败'), h('span', null, failure), h(Button, { onClick: () => runQuery(queryForm.getFieldsValue()) }, '重新查询'))
      : denied
        ? h('div', { className: 'ea-table-state' }, h('strong', null, '暂无查询权限'), h('span', null, table.permissionDeniedDescription || '请联系管理员开通当前数据范围的查询权限。'))
        : h(Empty, { description: table.emptyDescription || '暂无匹配记录' });

    const drawer = table.drawerDetail ? h(Drawer, {
      open: Boolean(detailRow),
      title: table.drawerDetail.title,
      width: 720,
      className: 'ea-detail-drawer',
      closeIcon: false,
      onClose: () => setDetailRow(null),
      extra: h(Button, {
        type: 'text',
        icon: h(CloseOutlined),
        'aria-label': '关闭详情',
        onClick: () => setDetailRow(null)
      }),
      footer: h('div', { className: 'ea-drawer-footer-actions' },
        h(Button, { onClick: () => setDetailRow(null) }, table.drawerDetail.closeLabel || '关闭'))
    }, detailRow ? h('div', { className: 'ea-drawer-detail' }, ...(table.drawerDetail.groups || []).map((group) => h('section', { key: group.key, className: 'ea-drawer-detail-group' },
      h('h3', null, group.title),
      h(Descriptions, {
        column: 2,
        size: 'small',
        items: (group.fields || []).map((field) => ({ key: field.key, label: field.label, children: detailValue(field, detailRow) }))
      })))) : null) : null;

    const confirmedActionModal = confirmedAction ? h(Modal, {
      open: true,
      title: confirmedAction.action.confirm?.title || confirmedAction.action.label,
      centered: true,
      width: 560,
      className: 'ea-confirm-action-modal',
      destroyOnClose: true,
      maskClosable: false,
      closable: !confirming,
      okText: confirmedAction.action.confirm?.okText || `确认${confirmedAction.action.label}`,
      cancelText: '取消',
      okButtonProps: { danger: confirmedAction.action.confirm?.danger === true, loading: confirming },
      cancelButtonProps: { disabled: confirming },
      onOk: () => confirmForm.submit(),
      onCancel: closeConfirmedAction
    },
    h('div', { className: 'ea-confirm-action-summary' },
      h('p', null, `${confirmedAction.action.confirm?.objectLabel || '操作对象'}：${confirmedAction.row[confirmedAction.action.confirm?.objectField || table.rowKey]}`),
      h('p', null, confirmedAction.action.confirm?.impact || `确认后账户状态将变更为“${confirmedAction.action.nextValue?.text || '-'}”。`),
      confirmedAction.action.confirm?.warning ? h('p', { className: 'ea-confirm-action-warning' }, confirmedAction.action.confirm.warning) : null),
    h(Form, { form: confirmForm, layout: 'vertical', onFinish: submitConfirmedAction },
      h(Form.Item, {
        label: confirmedAction.action.confirm?.reasonLabel || '操作原因',
        name: 'reason',
        rules: [
          { required: true, whitespace: true, message: '请填写操作原因' },
          { min: confirmedAction.action.confirm?.reasonMinLength || 5, message: `操作原因至少填写 ${confirmedAction.action.confirm?.reasonMinLength || 5} 个字` }
        ]
      }, h(Input.TextArea, {
        rows: 4,
        maxLength: confirmedAction.action.confirm?.reasonMaxLength || 200,
        showCount: true,
        placeholder: confirmedAction.action.confirm?.reasonPlaceholder || '请填写本次操作原因'
      })))) : null;

    const modalFields = modalFormConfig?.fields || [];
    const createModal = (rowModalAction || (primaryAction && primaryPresentation !== 'page')) ? h(primaryPresentation === 'drawer' ? Drawer : Modal, {
      open: createOpen,
      title: modalTitle,
      centered: true,
      width: 640,
      className: primaryPresentation === 'drawer' ? 'ea-create-drawer' : 'ea-create-modal',
      styles: primaryPresentation === 'drawer'
        ? { body: { overflowY: 'auto' } }
        : { body: { maxHeight: 'calc(80vh - 146px)', overflowY: 'auto' } },
      destroyOnClose: true,
      onCancel: requestLeaveCreate,
      onClose: requestLeaveCreate,
      footer: primaryPresentation === 'drawer'
        ? h('div', { className: 'ea-drawer-footer-actions' },
          h(Button, { key: 'cancel', disabled: creating, onClick: requestLeaveCreate }, modalSubmit.secondaryLabel || '取消'),
          h(Button, { key: 'submit', type: 'primary', loading: creating, onClick: () => createForm.submit() }, modalSubmit.primaryLabel || '保存'))
        : [
          h(Button, { key: 'cancel', disabled: creating, onClick: requestLeaveCreate }, modalSubmit.secondaryLabel || '取消'),
          h(Button, { key: 'submit', type: 'primary', loading: creating, onClick: () => createForm.submit() }, modalSubmit.primaryLabel || '保存')
        ]
    }, h(Form, {
      form: createForm,
      layout: 'vertical',
      initialValues: modalFormConfig?.initialValues || {},
      onValuesChange: (changed, values) => { normalizeDependentFields(createForm, modalFields, values); setDirty(true); },
      onFinish: createRecord,
      onFinishFailed: onCreateFailed,
      className: 'ea-create-form'
    }, h('div', { className: 'ea-create-form-grid' }, ...modalFields.map((field) => renderField(createForm, field, `form-${field.key}`, {
      className: field.fullWidth ? 'ea-create-form-item--full' : undefined,
      extra: field.help
    }))))) : null;

    function renderDetailSection(section, row) {
      const moduleStyle = { padding: 16, marginBottom: 16, borderRadius: 8 };
      const heading = (title, actions) => h('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }
      }, h('h2', { style: { fontSize: 14, margin: 0, fontWeight: 600 } }, title),
        h('div', null, ...(actions || []).map((item) => h(Button, {
          key: item.label, type: 'link', size: 'small',
          onClick: () => message.info(`${item.label}已触发`)
        }, item.label))));

      if (section.type === 'profile') {
        return h('section', { key: section.key, className: 'ea-module', style: moduleStyle },
          heading(section.title),
          h('div', { style: { display: 'flex', gap: 24, alignItems: 'center' } },
            h('div', { style: { width: 56, height: 56, borderRadius: 8, background: '#EDF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#1E75FF' } }, section.iconText || 'A'),
            h(Descriptions, {
              column: section.columns || 3, size: 'small', style: { flex: 1 },
              items: (section.fields || []).map((field) => ({
                key: field.key, label: field.label,
                children: field.format === 'status' ? status(row[field.source]) : (row[field.source] ?? '-')
              }))
            })));
      }
      if (section.type === 'metrics') {
        return h('section', { key: section.key, className: 'ea-module', style: moduleStyle },
          heading(section.title),
          h('div', { style: { display: 'flex', gap: 64 } }, ...(section.metrics || []).map((metric) => h('div', { key: metric.key },
            h('div', { style: { fontSize: 12, color: '#606266' } }, metric.label),
            h('div', { style: { fontSize: 20, fontWeight: 600, marginTop: 4 } }, String(row[metric.source] ?? metric.value ?? '0'))
          ))));
      }
      if (section.type === 'empty-card') {
        return h('section', { key: section.key, className: 'ea-module', style: moduleStyle },
          heading(section.title, section.actions),
          h('div', { style: { fontSize: 12, color: '#909399', marginBottom: 24 } }, section.note),
          h('div', { style: { textAlign: 'center', padding: '16px 0 28px' } },
            h('div', { style: { width: 96, height: 64, margin: '0 auto 12px', background: '#F5F4F5', borderRadius: 6, position: 'relative' } },
              h('div', { style: { position: 'absolute', left: 20, top: 14, width: 12, height: 12, borderRadius: '50%', background: '#1E75FF' } }),
              h('div', { style: { position: 'absolute', left: 14, top: 28, width: 24, height: 32, borderRadius: 4, background: '#1E75FF' } })),
            h('div', { style: { fontWeight: 600, marginBottom: 4 } }, section.emptyTitle || '暂无数据'),
            h('div', { style: { fontSize: 12, color: '#909399', marginBottom: 8 } }, section.emptyHint),
            h(Button, { type: 'link', size: 'small', onClick: () => message.info(`${section.emptyActionLabel || '立即处理'}已触发`) }, section.emptyActionLabel || '立即处理')));
      }
      if (section.type === 'table') {
        const rows = row[section.rowsSource] || [];
        return h('section', { key: section.key, className: 'ea-module', style: moduleStyle },
          heading(section.title, section.actions),
          h(Table, {
            rowKey: section.rowKey || 'id', dataSource: rows, pagination: false, size: 'middle',
            columns: (section.columns || []).map((column) => column.key === 'actions'
              ? { key: 'actions', title: column.label, render: () => h(Button, { type: 'link', size: 'small', danger: true, onClick: () => message.info('解绑已触发') }, column.actionLabel || '解绑') }
              : { key: column.key, title: column.label, dataIndex: column.key })
          }));
      }
      return null;
    }

    const pageDetailConfig = table.pageDetail;
    if (view === 'page-detail' && detailPageRow && pageDetailConfig) {
      const tabs = pageDetailConfig.tabs || [];
      const activeKey = detailPageTab || tabs[0]?.key || '';
      return h('div', { className: 'ea-page-content ea-page-detail' },
        h('div', { className: 'ea-page-form-heading', style: { display: 'flex', alignItems: 'center', gap: 16 } },
          h(Button, { type: 'text', className: 'ea-page-form-back', icon: h(ArrowLeftOutlined), onClick: () => setView('list') }, pageDetailConfig.backLabel || '返回'),
          tabs.length ? h(Tabs, {
            activeKey, size: 'small',
            items: tabs.map((tab) => ({ key: tab.key, label: tab.label })),
            onChange: setDetailPageTab,
            style: { flex: 1 }
          }) : null),
        activeKey === tabs[0]?.key || !tabs.length
          ? (pageDetailConfig.sections || []).map((section) => renderDetailSection(section, detailPageRow))
          : h('div', { className: 'ea-module', style: { padding: 48, textAlign: 'center', color: '#909399' } }, '暂无流水信息'));
    }

    const pageFormConfig = view === 'row-page-form' ? rowPageAction?.form : createConfig;
    const pageFormSubmit = pageFormConfig?.submit || {};
    const pageFormFields = (pageFormConfig?.groups || []).flatMap((group) => group.fields || []);
    const pageFormVisible = (view === 'create' && primaryPresentation === 'page') || view === 'row-page-form';
    if (pageFormVisible && pageFormConfig) {
      return h('div', { className: 'ea-page-content ea-page-form' },
        h('div', { className: 'ea-page-form-heading' },
          h(Button, {
            type: 'text',
            className: 'ea-page-form-back',
            icon: h(ArrowLeftOutlined),
            disabled: creating,
            onClick: requestLeaveCreate
          }, pageFormConfig.backLabel || '返回'),
          h('h1', null, pageFormConfig.title)),
        h(Form, {
          form: createForm,
          name: 'project-create',
          layout: 'horizontal',
          labelAlign: 'left',
          colon: false,
          labelCol: { flex: '148px' },
          wrapperCol: { flex: '620px' },
          initialValues: pageFormConfig.initialValues || {},
          onValuesChange: (changed, values) => { normalizeDependentFields(createForm, pageFormFields, values); setDirty(true); },
          onFinish: view === 'row-page-form' ? submitRowPageAction : createRecord,
          onFinishFailed: onCreateFailed,
          scrollToFirstError: true
        },
        h('div', { className: 'ea-page-form-groups' },
          ...(pageFormConfig.groups || []).map((group) => h(Form.Item, { key: `watch-group-${group.key}`, noStyle: true, shouldUpdate: true }, () => {
            const values = createForm.getFieldsValue(true);
            if (group.visibleWhen && !conditionMatches(group.visibleWhen, values)) return null;
            return h('section', { key: group.key, className: 'ea-module ea-page-form-group', 'aria-labelledby': `group-${group.key}` },
              h('h2', { id: `group-${group.key}` }, group.title),
              group.description ? h('p', { className: 'ea-page-form-group-description' }, group.description) : null,
              ...(group.fields || []).map((field) => renderField(createForm, field, `form-${field.key}`, { extra: field.help }, view === 'row-page-form' ? rowPageAction?.row : null)));
          }))),
        h('div', { className: 'ea-page-form-sticky-actions' },
          h('div', { className: 'ea-page-form-action-inner' },
            h(Button, { disabled: creating, onClick: pageFormSubmit.secondaryAction === 'reset' ? () => createForm.resetFields() : requestLeaveCreate }, pageFormSubmit.secondaryLabel || '取消'),
            h(Form.Item, { noStyle: true, shouldUpdate: true }, () => h(Button, { type: 'primary', loading: creating, htmlType: 'submit' }, resolveByField(pageFormSubmit.primaryLabelBy, createForm.getFieldsValue(true)) || pageFormSubmit.primaryLabel))))));
    }

    return h('div', { className: 'ea-page-content ea-list-page' },
      h('section', { className: 'ea-module ea-query-module', 'aria-label': '查询条件' },
        queryTabs ? h(Tabs, {
          className: 'ea-query-tabs',
          activeKey: activeView,
          items: views.map((item) => ({
            key: item.key,
            label: item.count === undefined ? item.label : `${item.label}(${item.count})`
          })),
          onChange: changeView
        }) : null,
        h(Form, { form: queryForm, layout: 'vertical', onFinish: runQuery, onValuesChange: (changed, values) => normalizeDependentFields(queryForm, fields, values) },
          h('div', { className: 'ea-query-grid' },
            ...visibleFields.map((field) => renderField(queryForm, field, `field-${field.key}`)),
            h('div', { className: 'ea-query-actions' },
              h(Button, { onClick: reset }, '重置'),
              h(Button, { type: 'primary', htmlType: 'submit', loading }, '查询'),
              supportsCollapse ? h(Button, {
                type: 'link',
                className: 'ea-query-expand-button',
                onClick: () => setCollapsed((value) => !value)
              }, collapsed ? '展开' : '收起', collapsed ? h(DownOutlined) : h(UpOutlined)) : null))
        )),
      h('section', { className: 'ea-module ea-result-module', 'aria-label': table.sectionTitle || '列表结果' },
        h('div', { className: `ea-result-toolbar${views.length && !queryTabs ? ' ea-result-toolbar--tabs' : ''}` },
          views.length && !queryTabs ? h(Tabs, {
            activeKey: activeView,
            items: views.map((item) => ({
              key: item.key,
              label: item.count === undefined ? item.label : `${item.label}(${item.count})`
            })),
            onChange: changeView
          }) : h('h2', null, listTitle(table)),
          denied ? null : h('div', { className: 'ea-result-actions' },
            ...(table.toolbarActions || []).map((action) => h(Button, {
              key: action.key,
              icon: action.type === 'export' && DownloadOutlined ? h(DownloadOutlined) : null,
              disabled: loading || matchedRows.length === 0,
              onClick: () => action.type === 'export' ? exportRows(action) : message.info(`${action.label}已触发`)
            }, action.label)),
            primaryAction ? h(Button, { type: 'primary', onClick: openCreate }, primaryAction.label) : null,
            h(Popover, {
              open: settingsOpen,
              onOpenChange: setSettingsOpen,
              trigger: 'click',
              content: columnSettings,
              placement: 'bottomRight'
            }, h(Tooltip, { title: '列设置' }, h(Button, { 'aria-label': '列设置', icon: h(SettingOutlined) }))))),
        h(Table, {
          className: 'ea-table',
          rowKey: table.rowKey,
          columns: dataColumns,
          dataSource: failure || denied ? [] : pagedRows,
          loading,
          locale: { emptyText },
          pagination: false,
          size: 'middle',
          scroll: { x: table.scrollX || 1080 }
        }),
        h('div', { className: 'ea-pagination-row' },
          h('span', { className: 'ea-pagination-total' }, `共 ${failure || denied ? 0 : matchedRows.length} 条`),
          h(Pagination, {
            current: page,
            pageSize,
            total: failure || denied ? 0 : matchedRows.length,
            showSizeChanger: true,
            pageSizeOptions: table.pagination?.pageSizeOptions || ['10', '20', '50', '100'],
            onChange: (nextPage, nextPageSize) => {
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
                setPage(1);
                return;
              }
              setPage(nextPage);
            },
            onShowSizeChange: (_, nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }
          })
        )
      ),
      drawer,
      createModal,
      confirmedActionModal);
  }

  function Page({ spec }) {
    if (spec.metadata.family === 'list') return h(ListPage, { spec });
    return h('div', { className: 'ea-page-content' }, h(Empty, { description: '当前页面族尚未接入 Ant Design Page Spec 运行时' }));
  }

  window.EasyAccountPageSpecRuntime = {
    mount(spec, target) {
      if (!target) throw new Error('EasyAccountPageSpecRuntime: target element not found.');
      ReactDOM.render(h(ConfigProvider, {
        theme: {
          token: { colorPrimary: '#1E75FF', borderRadius: 6 },
          components: {
            Button: { borderRadius: 6 },
            Table: {
              cellPaddingBlockMD: 10,
              cellPaddingInlineMD: 16,
              headerBg: '#F5F4F5',
              headerColor: '#606266'
            }
          }
        }
      }, h(Page, { spec })), target);
    }
  };
}());
