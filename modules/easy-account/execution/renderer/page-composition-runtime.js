(function () {
  'use strict';

  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const antd = window.antd;
  if (!React || !ReactDOM || !antd) throw new Error('EasyAccountCompositionRuntime requires React, ReactDOM and Ant Design.');

  const h = React.createElement;
  const { Button, Checkbox, ConfigProvider, DatePicker, Descriptions, Drawer, Empty, Form, Input, message, Modal, Pagination, Popover, Radio, Result, Select, Space, Statistic, Steps, Table, Tag, Tabs, Tooltip, Upload } = antd;
  const icons = window.icons || window.antdIcons || window.AntDesignIcons || {};
  const { ArrowLeftOutlined, DownloadOutlined, DownOutlined, SettingOutlined, UpOutlined } = icons;

  function region(page, type) {
    return (page.regions || []).find((item) => item.type === type);
  }

  function valueAt(source, path) {
    return String(path || '').split('.').filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], source);
  }

  function setAt(target, path, value) {
    const keys = String(path || '').split('.').filter(Boolean);
    if (!keys.length) return;
    let cursor = target;
    keys.slice(0, -1).forEach((key) => {
      cursor[key] = cursor[key] && typeof cursor[key] === 'object' ? cursor[key] : {};
      cursor = cursor[key];
    });
    cursor[keys[keys.length - 1]] = value;
  }

  function money(value, showCurrency = true) {
    const data = value && typeof value === 'object' ? value : { minor: String(value || '0'), currency: 'CNY' };
    const minor = String(data.minor || '0');
    const negative = minor.startsWith('-');
    const digits = (negative ? minor.slice(1) : minor).padStart(3, '0');
    const formatted = `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
    return showCurrency ? `${formatted} ${data.currency || 'CNY'}` : formatted;
  }

  function amountColumnTitle(column) {
    const label = String(column.label || '金额');
    if (column.mixedCurrency === true) return label;
    const unit = column.unit || ({ CNY: '元', USD: '美元', EUR: '欧元' }[column.currency] || column.currency || '元');
    if (label.endsWith(`(${unit})`)) return label;
    if (label.endsWith(`（${unit}）`)) return `${label.slice(0, -(unit.length + 2))}(${unit})`;
    return `${label}(${unit})`;
  }

  function statisticLabel(metric) {
    const label = String(metric.label || '指标');
    const unit = String(metric.unit || '').trim();
    if (unit && (label.endsWith(`(${unit})`) || label.endsWith(`（${unit}）`))) return label.slice(0, -(unit.length + 2));
    return label;
  }

  function statisticTitle(metric) {
    const label = statisticLabel(metric);
    const unit = String(metric.unit || '').trim();
    return unit ? `${label}(${unit})` : label;
  }

  function statistic(metric) {
    return h(Statistic, {
      key: metric.key,
      title: statisticTitle(metric),
      value: metric.value ?? '-',
      prefix: metric.prefix,
      precision: metric.precision
    });
  }

  function inlineSummary(metrics) {
    const children = [h('span', { key: 'label', className: 'ea-composition-inline-summary-label' }, '查询汇总：')];
    metrics.forEach((metric, index) => {
      if (index) children.push(h('span', { key: `separator-${metric.key}`, className: 'ea-composition-inline-summary-separator', 'aria-hidden': true }, '｜'));
      children.push(h('span', { key: metric.key, className: 'ea-composition-inline-summary-metric' },
        h('span', null, statisticLabel(metric)),
        ' ',
        h('span', { className: 'ea-composition-inline-summary-value' }, metric.value ?? '-'),
        metric.unit ? ` ${metric.unit}` : ''));
    });
    return h('div', { className: 'ea-composition-inline-summary', 'aria-label': '查询汇总' }, ...children);
  }

  function display(value, format) {
    if (format === 'amount') return money(value);
    if (format === 'status') {
      const item = value && typeof value === 'object' ? value : { text: String(value || '-'), tone: 'default' };
      return h(Tag, { color: item.tone || 'default' }, item.text || '-');
    }
    if (value && typeof value.format === 'function') return value.format('YYYY-MM-DD HH:mm:ss');
    return value == null || value === '' ? '-' : String(value);
  }

  function exportText(value, column) {
    if (column.format === 'amount') return money(value, column.mixedCurrency === true);
    if (value && typeof value === 'object') return value.text ?? value.value ?? '';
    if (Array.isArray(value)) return value.join('、');
    return value ?? '';
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function fieldControl(field) {
    const common = { placeholder: field.placeholder || `请输入${field.label}`, disabled: field.disabled };
    if (field.control === 'select') return h(Select, { ...common, allowClear: true, options: field.options || [] });
    if (field.control === 'radio') return h(Radio.Group, { disabled: field.disabled, options: field.options || [] });
    if (field.control === 'upload') return h(Upload, { beforeUpload: () => false, maxCount: field.maxCount || 1 }, h(Button, null, field.buttonLabel || '上传文件'));
    if (field.control === 'date') return h(DatePicker, { ...common, style: { width: '100%' } });
    if (field.control === 'date-range') return h(DatePicker.RangePicker, { ...common, style: { width: '100%' } });
    if (field.control === 'textarea') return h(Input.TextArea, { ...common, rows: field.rows || 3 });
    return h(Input, { ...common, inputMode: field.control === 'number' ? 'decimal' : undefined });
  }

  function fieldRules(field) {
    return field.required ? [{ required: true, message: field.validationMessage || `请填写${field.label}` }] : [];
  }

  function matches(row, fields, filters) {
    return fields.every((field) => {
      const expected = filters[field.key];
      if (expected === undefined || expected === null || expected === '') return true;
      const raw = row[field.filterKey || field.key];
      const actual = raw && typeof raw === 'object' ? raw.value ?? raw.text ?? raw.minor : raw;
      if (field.control === 'date-range' && Array.isArray(expected) && expected.length === 2) {
        const start = typeof expected[0]?.format === 'function' ? expected[0].format('YYYY-MM-DD') : String(expected[0] || '').slice(0, 10);
        const end = typeof expected[1]?.format === 'function' ? expected[1].format('YYYY-MM-DD') : String(expected[1] || '').slice(0, 10);
        const current = String(actual || '').slice(0, 10);
        return Boolean(current && start && end && current >= start && current <= end);
      }
      if (field.control === 'select') return String(actual) === String(expected);
      return String(actual || '').toLowerCase().includes(String(expected).toLowerCase());
    });
  }

  function queryInitialValues(config, tabKey) {
    const tab = (config.tabs || []).find((item) => item.key === tabKey);
    const values = { ...(config.initialValues || {}), ...(tab?.initialValues || {}) };
    const fields = [...(config.selectorFields || []), ...(tab?.selectorFields || []), ...(tab?.fields || config.fields || [])];
    fields.forEach((field) => {
      const value = values[field.key];
      if (field.control === 'date' && typeof value === 'string' && window.dayjs) values[field.key] = window.dayjs(value);
      if (field.control === 'date-range' && Array.isArray(value) && window.dayjs) values[field.key] = value.map((item) => typeof item === 'string' ? window.dayjs(item) : item);
    });
    return values;
  }

  function createStore() {
    let value = {};
    const listeners = new Set();
    return {
      get: () => value,
      update(next) { value = next; listeners.forEach((listener) => listener(value)); },
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    };
  }

  function useStore(store) {
    const [value, setValue] = React.useState(store.get());
    React.useEffect(() => store.subscribe(setValue), [store]);
    return value;
  }

  function formFieldCount(page) {
    return (region(page, 'step-form')?.config?.steps || []).reduce((total, step) => total + (step.fields || []).filter((field) => field.interactive !== false && field.kind !== 'display').length, 0);
  }

  function presentationFor(target, transition, policy) {
    if (transition?.presentation) return transition.presentation;
    if (target?.skeleton === 'detail-workbench') return policy?.detailPresentation?.listDefault || 'drawer';
    if (target?.skeleton === 'form-workflow') {
      const count = formFieldCount(target);
      const thresholds = policy?.thresholds || policy?.formPresentation;
      if (!thresholds) return target?.presentation || 'page';
      const modalMax = Number(thresholds.modalMaxFields);
      const drawerMax = Number(thresholds.drawerMaxFields);
      if (count > drawerMax) return 'page';
      if (count > modalMax) return 'drawer';
      return 'modal';
    }
    return 'page';
  }

  function overlayTransition(onTransition, closeOverlay) {
    return function (transitionId, payload) {
      const outcome = onTransition(transitionId, payload);
      if (outcome?.presentation === 'page') closeOverlay();
      return outcome;
    };
  }

  function QueryWorkbench({ page, context, pages, onTransition }) {
    const query = region(page, 'query');
    const overview = region(page, 'overview');
    const summary = region(page, 'summary');
    const table = region(page, 'table');
    const action = region(page, 'action');
    const config = query?.config || {};
    const tableConfig = table?.config || {};
    const defaultTab = config.defaultTabKey || config.tabs?.[0]?.key;
    const [form] = Form.useForm();
    const [managementForm] = Form.useForm();
    const [filters, setFilters] = React.useState(() => queryInitialValues(config, defaultTab));
    const [activeTab, setActiveTab] = React.useState(defaultTab);
    const [loading, setLoading] = React.useState(false);
    const [failure, setFailure] = React.useState('');
    const [denied, setDenied] = React.useState(false);
    const [collapsed, setCollapsed] = React.useState(false);
    const [pageNo, setPageNo] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(tableConfig.pagination?.pageSize || 10);
    const [overlay, setOverlay] = React.useState(null);
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [managementOpen, setManagementOpen] = React.useState(false);
    const [visibleKeys, setVisibleKeys] = React.useState(() => (tableConfig.columns || []).filter((column) => column.hidden !== true).map((column) => column.key));
    const overlayPage = overlay ? pages.find((item) => item.id === overlay.pageId) : null;
    const activeTabConfig = (config.tabs || []).find((tab) => tab.key === activeTab);
    const selectorFields = activeTabConfig?.selectorFields || config.selectorFields || [];
    const fields = activeTabConfig?.fields || config.fields || [];
    const overviewTabKeys = overview?.config?.visibleTabKeys;
    const overviewVisible = Boolean(overview && (!overviewTabKeys?.length || overviewTabKeys.includes(activeTab)));
    const summaryTabKeys = summary?.config?.visibleTabKeys;
    const summaryVisible = Boolean(summary && (!summaryTabKeys?.length || summaryTabKeys.includes(activeTab)));
    const combinedOverview = Boolean(selectorFields.length && overviewVisible);
    const filterFields = [...selectorFields, ...fields];
    const collapseThreshold = page.directorPolicy?.query?.collapseThreshold || 3;
    const supportsCollapse = fields.length > collapseThreshold;
    const visibleFields = collapsed ? fields.slice(0, collapseThreshold) : fields;
    const viewRows = (tableConfig.rows || []).filter((row) => Object.entries(activeTabConfig?.filter || {}).every(([key, value]) => String(row[key]) === String(value)));
    const rows = viewRows.filter((row) => matches(row, filterFields, filters));
    const pagedRows = rows.slice((pageNo - 1) * pageSize, pageNo * pageSize);
    const overviewSelectorKey = overview?.config?.selectorKey;
    const selectedOverviewKey = overviewSelectorKey ? filters[overviewSelectorKey] : undefined;
    const overviewMetrics = overview?.config?.metricsBySelector?.[selectedOverviewKey]
      || overview?.config?.metricsByTab?.[activeTab]
      || overview?.config?.metrics
      || [];
    const sourceSummaryMetrics = summary?.config?.metricsByTab?.[activeTab]
      || summary?.config?.metrics
      || [];
    const summaryMetrics = sourceSummaryMetrics.map((metric) => {
      if (metric.aggregate === 'count') return { ...metric, value: rows.length };
      if (metric.aggregate === 'sum') {
        const minor = rows.reduce((total, row) => {
          const value = valueAt(row, metric.field);
          const source = value && typeof value === 'object' ? value.minor : value;
          return total + BigInt(String(source || '0'));
        }, 0n);
        return { ...metric, value: money({ minor: minor.toString(), currency: metric.currency || 'CNY' }, false) };
      }
      if (metric.aggregate === 'sumNumber') {
        const total = rows.reduce((sum, row) => {
          const value = valueAt(row, metric.field);
          return sum + BigInt(String(value || '0'));
        }, 0n);
        return { ...metric, value: total.toString() };
      }
      return metric;
    });
    const inlineSummaryVisible = summaryVisible && summaryMetrics.length > 0 && summaryMetrics.length <= 3;
    const cardSummaryVisible = summaryVisible && summaryMetrics.length > 3;
    const managementConfig = overview?.config?.management;
    const management = overviewVisible && overview?.capabilities?.includes('overview.manage') && managementConfig?.visible !== false ? managementConfig : null;
    const createRule = () => managementForm.validateFields().then(() => {
      message.success(management?.successMessage || '规则信息已新增');
      managementForm.resetFields();
      setManagementOpen(false);
    });
    const runQuery = (values) => {
      setLoading(true);
      setFailure('');
      setDenied(false);
      setPageNo(1);
      window.setTimeout(() => {
        const valuesList = Object.values(values || {}).map((value) => String(value || '').trim().toUpperCase());
        if (valuesList.includes('ERROR')) setFailure('服务暂时不可用，请稍后重试。');
        else if (valuesList.includes('DENIED')) setDenied(true);
        else setFilters(values || {});
        setLoading(false);
      }, 220);
    };
    const resetQuery = () => {
      const selectedValues = Object.fromEntries(selectorFields.map((field) => [field.key, form.getFieldValue(field.key)]));
      const initialValues = { ...queryInitialValues(config, activeTab), ...selectedValues };
      form.resetFields();
      form.setFieldsValue(initialValues);
      setFilters(initialValues);
      setFailure('');
      setDenied(false);
      setPageNo(1);
    };
    const exportRows = (item) => {
      const exportColumns = (tableConfig.columns || []).filter((column) => column.key !== 'actions' && column.exportable !== false);
      const content = [
        exportColumns.map((column) => csvCell(column.format === 'amount' ? amountColumnTitle(column) : column.label)).join(','),
        ...rows.map((row) => exportColumns.map((column) => csvCell(exportText(row[column.key], column))).join(','))
      ].join('\n');
      const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName || `${page.label || '查询列表'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${rows.length} 条记录`);
    };
    const columns = (tableConfig.columns || []).filter((column) => visibleKeys.includes(column.key)).map((column) => {
      if (column.actions) return {
        key: column.key, title: column.label, width: column.width, fixed: 'right',
        render: (_, row) => h(Space, { size: 12 }, ...(column.actions || []).map((item) => h(Button, {
          key: item.key, type: 'link', size: 'small', onClick: () => {
            const outcome = onTransition(item.transitionId, { row, filters, rows });
            if (outcome?.presentation === 'drawer' || outcome?.presentation === 'modal') {
              setOverlay({ pageId: outcome.pageId, presentation: outcome.presentation });
            }
          }
        }, item.label)))
      };
      const isAmount = column.format === 'amount';
      return {
        key: column.key,
        dataIndex: column.key,
        title: isAmount ? amountColumnTitle(column) : column.label,
        width: column.width,
        align: isAmount ? 'right' : undefined,
        className: isAmount ? 'ea-amount-column' : undefined,
        render: (value) => isAmount ? money(value, column.mixedCurrency === true) : display(value, column.format)
      };
    });
    const columnSettings = h('div', { className: 'ea-composition-column-settings' },
      h('strong', null, '列设置'),
      ...(tableConfig.columns || []).filter((column) => column.key !== 'actions' && column.hideable !== false).map((column) => h(Checkbox, {
        key: column.key,
        checked: visibleKeys.includes(column.key),
        onChange: (event) => setVisibleKeys((current) => event.target.checked ? [...new Set([...current, column.key])] : current.filter((key) => key !== column.key))
      }, column.label)));
    const emptyText = failure
      ? h('div', { className: 'ea-composition-table-state' }, h('strong', null, '查询失败'), h('span', null, failure), h(Button, { onClick: () => runQuery(form.getFieldsValue()) }, '重新查询'))
      : denied
        ? h('div', { className: 'ea-composition-table-state' }, h('strong', null, '暂无查询权限'), h('span', null, '请联系管理员开通当前账户范围的查询权限。'))
        : h(Empty, { description: '暂无匹配数据' });
    return h('div', { className: 'ea-composition-page' },
      query ? h('section', { className: 'ea-composition-module' },
        config.tabs?.length ? h(Tabs, {
          className: 'ea-composition-query-tabs',
          activeKey: activeTab,
          items: config.tabs.map((tab) => ({ key: tab.key, label: tab.count === undefined ? tab.label : `${tab.label}(${tab.count})` })),
          onChange: (nextTab) => {
            const initialValues = queryInitialValues(config, nextTab);
            form.resetFields();
            setFilters(initialValues);
            setFailure('');
            setDenied(false);
            setCollapsed(false);
            setActiveTab(nextTab);
            setPageNo(1);
          }
        }) : null,
        h(Form, {
          key: activeTab || 'query',
          form,
          layout: 'vertical',
          style: combinedOverview ? { '--ea-overview-metric-count': Math.max(overviewMetrics.length, 1) } : undefined,
          initialValues: queryInitialValues(config, activeTab),
          onValuesChange: (changed, values) => {
            if (overviewSelectorKey && Object.hasOwn(changed, overviewSelectorKey)) {
              setFilters(values);
              setFailure('');
              setDenied(false);
              setPageNo(1);
            }
          },
          onFinish: runQuery
        },
          selectorFields.length ? h('div', { className: `ea-composition-query-selector-grid${combinedOverview ? ' ea-composition-query-selector-grid--overview' : ''}` },
            ...selectorFields.map((field) => h(Form.Item, { key: field.key, label: field.label, name: field.key, rules: fieldRules(field) }, fieldControl(field)))) : null,
          overviewVisible ? h('section', { className: 'ea-composition-query-overview', 'aria-label': overview.config?.title || '对象总览' },
            h('div', { className: 'ea-composition-query-overview-heading' },
              h('h2', null, overview.config?.title || '对象总览'),
              management ? h(Button, { htmlType: 'button', type: management.primary === false ? 'default' : 'primary', onClick: () => setManagementOpen(true) }, management.label || '管理') : null),
            h('div', { className: 'ea-composition-statistics ea-composition-overview-statistics' }, ...overviewMetrics.map(statistic)),
            management ? h(Modal, {
              open: managementOpen,
              title: management.title || management.label || '信息管理',
              width: management.width || 640,
              destroyOnClose: true,
              onCancel: () => { managementForm.resetFields(); setManagementOpen(false); },
              footer: h('div', { className: 'ea-composition-overlay-footer' },
                h(Button, { onClick: () => { managementForm.resetFields(); setManagementOpen(false); } }, '取消'),
                h(Button, { type: 'primary', onClick: createRule }, management.submitLabel || '新增'))
            }, h(Form, { form: managementForm, layout: 'vertical', className: 'ea-composition-overview-management-form', initialValues: management.initialValues || {} },
              ...(management.fields || []).map((field) => h(Form.Item, {
                key: field.key,
                className: field.fullSpan ? 'ea-composition-overview-management-form-item--full' : undefined,
                label: field.label,
                name: field.key,
                rules: fieldRules(field)
              }, fieldControl(field))))) : null) : null,
          config.queryTitle && !combinedOverview ? h('h2', { className: 'ea-composition-query-title' }, config.queryTitle) : null,
          h('div', { className: 'ea-composition-query-grid' },
            ...visibleFields.map((field) => h(Form.Item, { key: field.key, label: field.label, name: field.key, rules: fieldRules(field) }, fieldControl(field))),
            h('div', { className: 'ea-composition-query-actions' },
              h(Button, { disabled: loading, onClick: resetQuery }, '重置'),
              h(Button, { type: 'primary', htmlType: 'submit', loading }, '查询'),
              supportsCollapse ? h(Button, {
                type: 'link',
                className: 'ea-composition-query-expand-button',
                onClick: () => setCollapsed((value) => !value)
              }, collapsed ? '展开' : '收起', collapsed ? (DownOutlined ? h(DownOutlined) : null) : (UpOutlined ? h(UpOutlined) : null)) : null)))
      ) : null,
      cardSummaryVisible ? h('section', { className: 'ea-composition-query-result-summary', 'aria-label': summary.config?.title || '查询结果汇总' },
        h('div', { className: 'ea-composition-statistics ea-composition-summary-statistics' }, ...summaryMetrics.map(statistic))) : null,
      table ? h('section', { className: 'ea-composition-module ea-composition-table' },
        h('div', { className: 'ea-composition-heading' }, inlineSummaryVisible ? inlineSummary(summaryMetrics) : h('h2', null, tableConfig.title || '查询列表'),
          h('div', { className: 'ea-composition-result-actions' },
          action?.config?.actions?.length ? h(Space, null, ...action.config.actions.filter((item) => !denied || item.type !== 'export').map((item) => h(Button, {
            key: item.key,
            type: item.primary ? 'primary' : 'default',
            icon: item.type === 'export' && DownloadOutlined ? h(DownloadOutlined) : null,
            disabled: loading || (item.type === 'export' && rows.length === 0),
            onClick: () => {
              if (item.type === 'export') {
                exportRows(item);
                return;
              }
              const outcome = onTransition(item.transitionId, { filters, rows });
              if (outcome?.presentation === 'drawer' || outcome?.presentation === 'modal') {
                setOverlay({ pageId: outcome.pageId, presentation: outcome.presentation });
              }
            }
          }, item.label))) : null,
          h(Popover, { open: settingsOpen, onOpenChange: setSettingsOpen, trigger: 'click', content: columnSettings, placement: 'bottomRight' },
            h(Tooltip, { title: '列设置' }, h(Button, { 'aria-label': '列设置', icon: SettingOutlined ? h(SettingOutlined) : null }))))),
        h(Table, { rowKey: tableConfig.rowKey || 'id', columns, dataSource: failure || denied ? [] : pagedRows, loading, pagination: false, size: 'middle', scroll: { x: tableConfig.scrollX || 960 }, locale: { emptyText } }),
        h('div', { className: 'ea-composition-pagination' }, h('span', null, `共 ${failure || denied ? 0 : rows.length} 条`), h(Pagination, {
          current: pageNo,
          pageSize,
          total: failure || denied ? 0 : rows.length,
          showSizeChanger: true,
          pageSizeOptions: tableConfig.pagination?.pageSizeOptions || ['10', '20', '50', '100'],
          onChange: (nextPage, nextPageSize) => {
            if (nextPageSize !== pageSize) {
              setPageSize(nextPageSize);
              setPageNo(1);
              return;
            }
            setPageNo(nextPage);
          },
          onShowSizeChange: (_, nextPageSize) => { setPageSize(nextPageSize); setPageNo(1); }
        })),
        overlayPage && overlayPage.skeleton === 'detail-workbench' ? h(Drawer, {
          open: true,
          title: overlayPage.label,
          width: 560,
          className: 'ea-composition-overlay-drawer',
          destroyOnClose: true,
          onClose: () => setOverlay(null),
          footer: h('div', { className: 'ea-composition-overlay-footer' }, h(Button, { onClick: () => setOverlay(null) }, '关闭'))
        }, h(DetailWorkbench, { page: overlayPage, context, embedded: true })) : null,
        overlayPage && overlayPage.skeleton === 'form-workflow' && overlay?.presentation === 'drawer' ? h(Drawer, {
          open: true,
          title: overlayPage.label,
          width: 720,
          className: 'ea-composition-overlay-drawer',
          destroyOnClose: true,
          onClose: () => setOverlay(null),
          footer: null
        }, h(FormWorkflow, { page: overlayPage, context, onTransition: overlayTransition(onTransition, () => setOverlay(null)) })) : null,
        overlayPage && overlayPage.skeleton === 'form-workflow' && overlay?.presentation === 'modal' ? h(Modal, {
          open: true,
          title: overlayPage.label,
          width: 640,
          destroyOnClose: true,
          onCancel: () => setOverlay(null),
          footer: null
        }, h(FormWorkflow, { page: overlayPage, context, onTransition: overlayTransition(onTransition, () => setOverlay(null)) })) : null
      ) : null
    );
  }

  function FormWorkflow({ page, context, onTransition }) {
    const formRegion = region(page, 'step-form');
    const review = region(page, 'review');
    const action = region(page, 'action');
    const config = formRegion?.config || {};
    const steps = config.steps || [];
    const [form] = Form.useForm();
    const [current, setCurrent] = React.useState(0);
    const [dirty, setDirty] = React.useState(false);
    const currentStep = steps[current] || { fields: [] };
    const submit = () => form.validateFields().then((values) => {
      const transition = (page.transitions || []).find((item) => item.event === 'submitted');
      onTransition(transition?.id, { values, submission: { status: 'success', values } });
    });
    const cancel = () => {
      const cancelTransitionId = action?.config?.cancelTransitionId || action?.cancelTransitionId;
      if (!cancelTransitionId) return;
      const leave = () => onTransition(cancelTransitionId, {});
      if (!dirty) return leave();
      Modal.confirm({ title: '放弃未保存修改？', content: '返回后当前填写内容将不会保留。', okText: '放弃并返回', cancelText: '继续编辑', centered: true, onOk: leave });
    };
    const grouped = config.layout === 'grouped';
    if (grouped) return h('div', { className: 'ea-composition-page ea-composition-form-page' },
      h('div', { className: 'ea-composition-form-back-row' },
        h(Button, { type: 'text', className: 'ea-composition-form-back', icon: ArrowLeftOutlined ? h(ArrowLeftOutlined) : null, onClick: cancel }, config.backLabel || '返回')),
      h(Form, { form, layout: 'vertical', initialValues: context[page.id] || config.initialValues || {}, onValuesChange: () => setDirty(true) },
        h('div', { className: 'ea-composition-form-groups' }, ...(steps || []).map((step) => h('section', { key: step.title, className: 'ea-composition-module ea-composition-form-group' },
          h('h2', null, step.title),
          h('div', { className: 'ea-composition-form-group-fields' }, ...(step.fields || []).map((field) => h(Form.Item, { key: field.key, label: field.label, name: field.key, rules: fieldRules(field) }, fieldControl(field))))))),
        review ? h('section', { className: 'ea-composition-module ea-composition-review' }, h('h2', null, review.config?.title || '提交前复核'), h(Descriptions, { column: 2, size: 'small', items: (review.config?.fields || []).map((field) => ({ key: field.key, label: field.label, children: valueAt(form.getFieldsValue(), field.source || field.key) || '-' })) })) : null,
        h('div', { className: 'ea-composition-form-sticky-actions' },
          h('div', { className: 'ea-composition-actions' },
            action?.config?.cancelLabel ? h(Button, { onClick: cancel }, action.config.cancelLabel) : null,
            h(Button, { type: 'primary', onClick: submit }, action?.config?.submitLabel || '提交')))));
    return h('div', { className: 'ea-composition-page' },
      h('section', { className: 'ea-composition-module ea-composition-form' },
        h('div', { className: 'ea-composition-heading' },
          h(Button, { type: 'text', className: 'ea-composition-form-back', icon: ArrowLeftOutlined ? h(ArrowLeftOutlined) : null, onClick: cancel }, config.backLabel || '返回'),
          h('h1', null, config.title || page.label)),
        h(Steps, { className: 'ea-composition-steps', current, items: steps.map((step) => ({ title: step.title })) }),
        h(Form, { form, layout: 'vertical', initialValues: context[page.id] || config.initialValues || {}, onValuesChange: () => setDirty(true) },
          ...(currentStep.fields || []).map((field) => h(Form.Item, { key: field.key, label: field.label, name: field.key, rules: fieldRules(field) }, fieldControl(field))),
          current === steps.length - 1 && review ? h('section', { className: 'ea-composition-review' }, h('h2', null, review.config?.title || '提交前复核'), h(Descriptions, { column: 1, size: 'small', items: (review.config?.fields || []).map((field) => ({ key: field.key, label: field.label, children: valueAt(form.getFieldsValue(), field.source || field.key) || '-' })) })) : null),
        h('div', { className: 'ea-composition-actions' },
          action?.config?.cancelLabel ? h(Button, { onClick: cancel }, action.config.cancelLabel) : null,
          current > 0 ? h(Button, { onClick: () => setCurrent(current - 1) }, '上一步') : null,
          current < steps.length - 1 ? h(Button, { type: 'primary', onClick: () => form.validateFields().then(() => setCurrent(current + 1)) }, '下一步') : h(Button, { type: 'primary', onClick: submit }, action?.config?.submitLabel || '提交'))
      )
    );
  }

  function ResultWorkflow({ page, context, onTransition }) {
    const result = region(page, 'result');
    const action = region(page, 'action');
    const config = result?.config || {};
    const state = context[page.id]?.submission || config.state || { status: 'success' };
    const status = state.status || config.status || 'success';
    const statusMap = { success: 'success', processing: 'info', failure: 'error' };
    return h('div', { className: 'ea-composition-page' }, h('section', { className: 'ea-composition-module ea-composition-result' },
      h(Result, { status: statusMap[status] || 'info', title: state.title || config.title || '操作已完成', subTitle: state.description || config.description }),
      (config.summary || []).length ? h('section', { className: 'ea-composition-result-summary' }, h('h2', null, config.summaryTitle || '结果摘要'), h(Descriptions, { column: 2, size: 'small', items: config.summary.map((field) => ({ key: field.key, label: field.label, children: display(valueAt(context[page.id] || state, field.source || field.key), field.format) })) })) : null,
      action?.config?.actions?.length ? h('div', { className: 'ea-composition-actions' }, ...action.config.actions.map((item) => h(Button, { key: item.key, type: item.primary ? 'primary' : 'default', onClick: () => onTransition(item.transitionId, { result: state }) }, item.label))) : null
    ));
  }

  function DetailWorkbench({ page, context, embedded = false }) {
    const detail = region(page, 'detail');
    const overview = region(page, 'overview');
    const config = detail?.config || {};
    const metrics = overview?.config?.metrics || config.metrics || [];
    return h('div', { className: 'ea-composition-page' }, h('section', { className: 'ea-composition-module' },
      embedded ? null : h('div', { className: 'ea-composition-heading' }, h('h1', null, config.title || page.label)),
      metrics.length ? h('section', { className: 'ea-composition-detail-overview', 'aria-label': overview?.config?.title || config.metricsTitle || '数据概览' },
        h('h2', null, overview?.config?.title || config.metricsTitle || '数据概览'),
        h('div', { className: 'ea-composition-statistics ea-composition-overview-statistics' }, ...metrics.map(statistic))) : null,
      h(Descriptions, { column: 2, size: 'small', items: (config.fields || []).map((field) => ({ key: field.key, label: field.label, children: display(valueAt(context[page.id] || config.data || {}, field.source || field.key), field.format) })) })
    ));
  }

  function CompositionPage({ page, store, pages, transition }) {
    const context = useStore(store);
    if (page.skeleton === 'query-workbench') return h(QueryWorkbench, { page, context, pages, onTransition: transition });
    if (page.skeleton === 'form-workflow') return h(FormWorkflow, { page, context, onTransition: transition });
    if (page.skeleton === 'result-workflow') return h(ResultWorkflow, { page, context, onTransition: transition });
    if (page.skeleton === 'detail-workbench') return h(DetailWorkbench, { page, context });
    return h('div', { className: 'ea-composition-page ea-composition-empty' }, h(Empty, { description: '当前骨架尚未接入运行时' }));
  }

  function normalizePages(spec) {
    const rootId = spec.metadata.pageId || 'root';
    return [{ id: rootId, label: spec.metadata.pageName, skeleton: spec.skeleton, regions: spec.regions, bindings: spec.bindings || [], transitions: spec.transitions || [], states: spec.states || {}, directorPolicy: spec.directorPolicy }]
      .concat(((spec.workflow && spec.workflow.pages) || []).map((page) => ({ ...page, directorPolicy: spec.directorPolicy })));
  }

  function sourceValue(scope, payload, context) {
    if (scope === 'row') return payload.row;
    if (scope === 'query') return payload.filters;
    if (scope === 'form') return payload.values;
    if (scope === 'submission') return payload.submission;
    if (scope === 'result') return payload.result;
    return context;
  }

  function mount(spec, shell) {
    if (!shell?.openTab) throw new Error('EasyAccountCompositionRuntime requires an EasyAccountShell instance.');
    const pages = normalizePages(spec);
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const rootId = pages[0].id;
    const store = createStore();
    const mounted = new Map();

    function openPage(id) {
      const page = pageById.get(id);
      if (!page) throw new Error(`EasyAccountCompositionRuntime: workflow page not found: ${id}`);
      let target = mounted.get(id);
      if (!target) {
        target = document.createElement('div');
        mounted.set(id, target);
        shell.openTab({ id, label: page.label, pinned: id === rootId, closable: id !== rootId, content: target });
        ReactDOM.render(h(ConfigProvider, { theme: { token: { colorPrimary: '#1E75FF', borderRadius: 6 }, components: { Button: { borderRadius: 6 }, Table: { cellPaddingBlockMD: 10, cellPaddingInlineMD: 16, headerBg: '#F5F4F5', headerColor: '#606266' } } } }, h(CompositionPage, { page, pages, store, transition: (transitionId, payload) => runTransition(page, transitionId, payload || {}) })), target);
      } else shell.activateTab(id);
    }

    function runTransition(page, transitionId, payload) {
      const transition = (page.transitions || []).find((item) => item.id === transitionId);
      if (!transition) return;
      const nextContext = { ...store.get() };
      const bindings = new Map((page.bindings || []).map((binding) => [binding.id, binding]));
      for (const bindingId of transition.bindingIds || []) {
        const binding = bindings.get(bindingId);
        if (!binding) continue;
        const targetPageId = binding.to.pageId || transition.to;
        const target = { ...(nextContext[targetPageId] || {}) };
        setAt(target, binding.to.path, valueAt(sourceValue(binding.from.scope, payload, nextContext), binding.from.path));
        nextContext[targetPageId] = target;
      }
      if (payload.submission) nextContext[transition.to] = { ...(nextContext[transition.to] || {}), submission: payload.submission };
      store.update(nextContext);
      const targetPage = pageById.get(transition.to);
      const presentation = presentationFor(targetPage, transition, spec.directorPolicy);
      if (presentation === 'page') openPage(transition.to);
      return { presentation, pageId: transition.to };
    }

    openPage(rootId);
    return { openPage, getContext: store.get, getPages: () => pages.map((page) => ({ id: page.id, label: page.label })) };
  }

  window.EasyAccountCompositionRuntime = { mount };
}());
