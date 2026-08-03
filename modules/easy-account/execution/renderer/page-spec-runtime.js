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
    Table,
    Tag,
    Tabs,
    Tooltip,
    Upload,
    message
  } = antd;
  const { ArrowLeftOutlined, CloseOutlined, DownOutlined, SettingOutlined, UpOutlined, UploadOutlined } = icons;

  function amount(value) {
    const data = value && typeof value === 'object' ? value : { minor: String(value || '0'), currency: 'CNY' };
    const minor = String(data.minor || '0');
    const negative = minor.startsWith('-');
    const digits = (negative ? minor.slice(1) : minor).padStart(3, '0');
    const major = `${digits.slice(0, -2)}.${digits.slice(-2)}`.replace(/^0+(?=\d)/, '');
    return h(Space, { size: 4 }, `${negative ? '-' : ''}${major}`, h('span', { className: 'ea-ant-currency' }, data.currency || 'CNY'));
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

  function control(field, id) {
    const placeholder = field.placeholder || (field.control === 'select' ? `请选择${field.label}` : `请输入${field.label}`);
    const common = { id, placeholder, disabled: field.disabled, maxLength: field.maxLength };
    if (field.control === 'select') return h(Select, { ...common, allowClear: true, options: field.options || [] });
    if (field.control === 'radio') return h(Radio.Group, { id, disabled: field.disabled, options: field.options || [] });
    if (field.control === 'upload') return h(Upload, {
      id,
      accept: field.accept || 'image/*',
      beforeUpload: () => false,
      maxCount: field.maxCount || 1,
      listType: field.listType || 'picture'
    }, h(Button, { icon: UploadOutlined ? h(UploadOutlined) : null, className: 'ea-upload-trigger' }, field.buttonLabel || '上传文件'));
    if (field.control === 'date') return h(DatePicker, { ...common, format: field.format || 'YYYY-MM-DD', style: { width: '100%' } });
    if (field.control === 'date-range') return h(DatePicker.RangePicker, { ...common, format: field.format || 'YYYY-MM-DD', style: { width: '100%' } });
    if (field.control === 'textarea') return h(Input.TextArea, { ...common, rows: field.rows || 3, showCount: Boolean(field.maxLength) });
    return h(Input, { ...common, inputMode: field.control === 'number' ? 'decimal' : undefined });
  }

  function matches(row, fields, filters) {
    return fields.every((field) => {
      const value = filters[field.key];
      if (value === undefined || value === null || value === '') return true;
      const source = row[field.filterKey || field.key];
      const sourceValue = source && typeof source === 'object' ? source.value ?? source.text ?? source.minor : source;
      if (field.control === 'select') return String(sourceValue) === String(value);
      return String(sourceValue || '').toLowerCase().includes(String(value).toLowerCase());
    });
  }

  function formRules(field) {
    const rules = [];
    if (field.required) rules.push({ required: true, message: field.validationMessage || `请填写${field.label}` });
    if (field.validationPattern) rules.push({ pattern: new RegExp(field.validationPattern), message: field.patternMessage || `${field.label}格式不正确` });
    return rules;
  }

  function detailValue(field, row) {
    if (field.format === 'amount') return amount(row[field.source]);
    if (field.format === 'status') return status(row[field.source]);
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

  function listTitle(table) {
    return table.sectionTitle || '查询列表';
  }

  function ListPage({ spec }) {
    const table = spec.list.table;
    const baseFields = spec.list.query.fields || [];
    const views = table.views || [];
    const primaryAction = table.primaryAction;
    const createConfig = primaryAction?.form;
    const createSubmit = createConfig?.submit || createConfig || {};
    const [queryForm] = Form.useForm();
    const [createForm] = Form.useForm();
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
    const [createOpen, setCreateOpen] = React.useState(false);
    const [view, setView] = React.useState('list');
    const [activeView, setActiveView] = React.useState(views[0]?.key);
    const [rowPageAction, setRowPageAction] = React.useState(null);
    const [dirty, setDirty] = React.useState(false);
    const [creating, setCreating] = React.useState(false);
    const selectedView = views.find((item) => item.key === activeView);
    const fields = selectedView?.queryFields || baseFields;
    const queryTabs = views.some((item) => Array.isArray(item.queryFields));
    const collapseThreshold = spec.list.query.collapseThreshold || 3;
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
      if (allRows.some((row) => String(row[rowKey]) === String(values[rowKey]))) {
        const keyLabel = (createConfig?.groups || []).flatMap((group) => group.fields || []).find((field) => field.key === rowKey)?.label || rowKey;
        createForm.setFields([{ name: rowKey, errors: [`${keyLabel}已存在，请重新输入`] }]);
        return;
      }
      setCreating(true);
      window.setTimeout(() => {
        const record = normalizeRecord(values, createConfig?.recordDefaults, table);
        setAllRows((current) => [record, ...current]);
        setPage(1);
        setCreating(false);
        setDirty(false);
        setCreateOpen(false);
        setView('list');
        createForm.resetFields();
        message.success(createSubmit.successMessage || '新增成功');
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
      if ((primaryAction?.presentation || 'modal') === 'page') setView('create');
      else setCreateOpen(true);
    };

    const handleRowAction = (action, row) => {
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
      message.info(`${action.label}已触发`);
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
          render: (_, row) => h(Space, { size: 12 }, ...(column.actions || []).map((action) => h(Button, {
            key: action.key,
            type: 'link',
            size: 'small',
            onClick: () => handleRowAction(action, row)
          }, action.label)))
        };
        return {
          key: column.key,
          dataIndex: column.key,
          title: column.label,
          width: column.width,
          ellipsis: false,
          render: column.format === 'amount'
            ? amount
            : column.format === 'status'
              ? status
              : column.format === 'stack'
                ? (_, row) => stackCell(column, row)
                : undefined
        };
      });

    const emptyText = failure
      ? h('div', { className: 'ea-table-state' }, h('strong', null, '查询失败'), h('span', null, failure), h(Button, { onClick: () => runQuery(queryForm.getFieldsValue()) }, '重新查询'))
      : denied
        ? h('div', { className: 'ea-table-state' }, h('strong', null, '暂无查询权限'), h('span', null, '请联系管理员开通当前项目范围的查询权限。'))
        : h(Empty, { description: '暂无匹配项目' });

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

    const modalFields = createConfig?.fields || [];
    const createModal = primaryAction && (primaryAction.presentation || 'modal') === 'modal' ? h(Modal, {
      open: createOpen,
      title: createConfig.title,
      centered: true,
      width: 640,
      className: 'ea-create-modal',
      styles: { body: { maxHeight: 'calc(80vh - 146px)', overflowY: 'auto' } },
      destroyOnClose: true,
      onCancel: requestLeaveCreate,
      footer: [
        h(Button, { key: 'cancel', disabled: creating, onClick: requestLeaveCreate }, createSubmit.secondaryLabel || '取消'),
        h(Button, { key: 'submit', type: 'primary', loading: creating, onClick: () => createForm.submit() }, createSubmit.primaryLabel)
      ]
    }, h(Form, {
      form: createForm,
      layout: 'vertical',
      onValuesChange: () => setDirty(true),
      onFinish: createRecord,
      onFinishFailed: onCreateFailed,
      className: 'ea-create-form'
    }, h('div', { className: 'ea-create-form-grid' }, ...modalFields.map((field) => h(Form.Item, {
      key: field.key,
      label: field.label,
      name: field.key,
      rules: formRules(field)
    }, control(field, `form-${field.key}`)))))) : null;

    const pageFormConfig = view === 'row-page-form' ? rowPageAction?.form : createConfig;
    const pageFormSubmit = pageFormConfig?.submit || {};
    const pageFormVisible = (view === 'create' && primaryAction?.presentation === 'page') || view === 'row-page-form';
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
          onValuesChange: () => setDirty(true),
          onFinish: view === 'row-page-form' ? submitRowPageAction : createRecord,
          onFinishFailed: onCreateFailed,
          scrollToFirstError: true
        },
        h('div', { className: 'ea-page-form-groups' },
          ...(pageFormConfig.groups || []).map((group) => h('section', { key: group.key, className: 'ea-module ea-page-form-group', 'aria-labelledby': `group-${group.key}` },
            h('h2', { id: `group-${group.key}` }, group.title),
            group.description ? h('p', { className: 'ea-page-form-group-description' }, group.description) : null,
            ...(group.fields || []).map((field) => h(Form.Item, {
              key: field.key,
              label: field.label,
              name: field.key,
              rules: formRules(field),
              extra: field.help
            }, control(field, `form-${field.key}`)))))),
        h('div', { className: 'ea-page-form-sticky-actions' },
          h('div', { className: 'ea-page-form-action-inner' },
            h(Button, { disabled: creating, onClick: requestLeaveCreate }, pageFormSubmit.secondaryLabel || '取消'),
            h(Button, { type: 'primary', loading: creating, htmlType: 'submit' }, pageFormSubmit.primaryLabel)))));
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
        h(Form, { form: queryForm, layout: 'vertical', onFinish: runQuery },
          h('div', { className: 'ea-query-grid' },
            ...visibleFields.map((field) => h(Form.Item, { key: field.key, label: field.label, name: field.key }, control(field, `field-${field.key}`))),
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
      createModal);
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
          token: { colorPrimary: '#1E75FF', borderRadius: 4 },
          components: { Button: { borderRadius: 6 } }
        }
      }, h(Page, { spec })), target);
    }
  };
}());
