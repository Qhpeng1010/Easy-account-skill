# Easy Account Page Spec Core Context

- `EA-VIS-001` to `EA-VIS-013` define the visual constitution, including the Shell fallback for an active tab without mounted page content.
- `EA-TPL-001` to `EA-TPL-015` define page family, page-scheme selection and capability boundaries.
- `EA-INT-001` to `EA-INT-013` define workflow, state, permission and acceptance behavior.
- Amounts use integer minor units or strings; never perform accounting arithmetic with JavaScript floating point.
- The renderer owns only Easy Account shell and components. Unsupported capability declarations are rejected by contract validation.
