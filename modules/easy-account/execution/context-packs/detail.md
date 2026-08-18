# Easy Account Detail Context

- Detail content is grouped by identity, account state, balances, linked records and audit log.
- Sensitive fields stay masked unless the current permission explicitly allows clear text.
- Amount metrics show currency and accounting definition. Mutating actions state preconditions and impact.
- Drawer details use a full-height vertical layout: Header stays fixed, Body scrolls independently, and Footer stays fixed at the bottom. Keep the Header title as the only title, use `24px` padding on all four body sides, place the close icon at the far right of the Header, and place Footer actions at the bottom-right with an `8px` gap between buttons.
