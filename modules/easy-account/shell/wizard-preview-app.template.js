window.createWizardPreview = function (steps) {
  const root = document.createElement("section");
  root.className = "ea-wizard";
  root.innerHTML = `<div class="ea-wizard__steps">${steps
    .map((label, index) => `<div class="ea-wizard__step${index === 0 ? " is-active" : ""}"><span class="ea-wizard__index">${index + 1}</span><span>${label}</span></div>`)
    .join("")}</div><div data-wizard-content></div>`;
  return root;
};
