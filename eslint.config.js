/** @type {import('eslint').Linter.Config} */
export default {
  root: true,
  ignores: ["dist/**", "build/**", "node_modules/**", "*.d.ts"],
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2023,
      sourceType: "module"
    }
  },
  rules: {
    "no-console": "warn",
    "no-debugger": "error"
  }
};
