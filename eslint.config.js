import js from "@eslint/js";
import solid from "eslint-plugin-solid/configs/typescript";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "test-results/**", "playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    ...solid,
    languageOptions: { parser: tseslint.parser, globals: globals.browser }
  },
  {
    files: ["src/App.tsx"],
    rules: { "solid/no-innerhtml": "off" }
  },
  {
    files: ["tests/**/*.js", "*.config.{js,ts}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  }
];
