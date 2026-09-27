export default [{
  files: ["src/**/*.js", "scripts/**/*.mjs"],
  languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { window: "readonly", document: "readonly", HTMLElement: "readonly", customElements: "readonly", URL: "readonly" } },
  rules: { "no-unused-vars": "error", "no-undef": "error" }
}];
