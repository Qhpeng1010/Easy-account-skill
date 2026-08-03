# Easy Account Result Context

- Result remains workflow-only until the generated preview has been manually accepted by the business user; no browser-automated acceptance is required.
- Success, processing and failure use distinct text, status and recovery actions.
- Keep one primary next action and make retryability explicit.
- Standard list titles default to “查询列表”; an explicit `table.sectionTitle` requirement may replace it.
- Table pagination uses a left/right split: the left side shows `共 X 条`, and the right side uses Ant Design Pagination with page navigation, a page-size selector, and additional-page controls. Changing page size resets to page 1.
