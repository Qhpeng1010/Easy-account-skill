# Open Form Field Contract

Page templates decide the page skeleton and placement. They do not gate field-level component behavior. Use this contract for query fields, Modal and Drawer fields, page forms, step forms, and overview-management forms.

## Components

Use `control` for common controls: `input`, `textarea`, `number`, `select`, `cascader`, `radio`, `checkbox`, `checkbox-group`, `switch`, `date`, `date-range`, `time`, `time-range`, `tree`, `tree-select`, `upload`, `slider`, `rate`, `autocomplete`, and `mentions`.

For another Ant Design form component, set its exported component name in `component` and pass JSON-serializable static properties through `props`. A component request must not become a capability gap merely because it is absent from the common-control list. Event handlers and executable JavaScript are not Page Spec data; express business interaction with the conditions below or extend the fixed runtime when a genuinely new interaction primitive is required.

`select` accepts `mode: "multiple"` or `multiple: true`. Multi-value fields use arrays in `initialValues`, form submission, and query filters. `cascader` uses nested Ant Design `options`. `checkbox` and `switch` bind through `checked`; `upload` binds through `fileList`.

## Conditions

Fields accept `visibleWhen`, `disabledWhen`, and `requiredWhen`. A condition can compare one field or combine conditions with `all`, `any`, or `not`.

Operators: `equals`, `notEquals`, `in`, `notIn`, `includes`, `includesAny`, `includesAll`, `empty`, `notEmpty`, `truthy`, and `falsy`. Omitting `operator` means `equals`.

Use `optionsBy` when another field changes the available enum:

```json
{
  "key": "ruleType",
  "label": "分账规则",
  "control": "radio",
  "optionsBy": {
    "field": "feeType",
    "map": {
      "revenue": [{ "label": "比例", "value": "ratio" }],
      "fixed": [
        { "label": "金额", "value": "amount" },
        { "label": "固定日期固定金额", "value": "fixed-date-amount" }
      ]
    }
  }
}
```

When a dependency changes, the runtime clears a value that is no longer visible or no longer present in its available options. Set `preserveWhenHidden: true` or `resetWhenDependenciesChange: false` only when the requirement explicitly says to retain it.

## Linked Rule Example

```json
[
  {
    "key": "supportedPlatforms",
    "label": "支持平台",
    "control": "select",
    "mode": "multiple",
    "options": [],
    "visibleWhen": { "field": "feeType", "value": "revenue" }
  },
  {
    "key": "storeScope",
    "label": "适用商户",
    "control": "radio",
    "options": [
      { "label": "全部", "value": "all" },
      { "label": "指定门店", "value": "specified" }
    ]
  },
  {
    "key": "storeFile",
    "label": "门店列表",
    "control": "upload",
    "visibleWhen": { "field": "storeScope", "value": "specified" }
  },
  {
    "key": "chargeDates",
    "label": "扣费日期",
    "control": "select",
    "mode": "multiple",
    "visibleWhen": { "field": "ruleType", "value": "fixed-date-amount" }
  }
]
```
