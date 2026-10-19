import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      ".kix-protocol-gate/",
      "**/coverage/",
      "**/*.d.ts",
      "**/*.css",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    // React runs only in apps/web. The e2e harness intentionally names its
    // Playwright-fixture helper `useBrowser`, which is not a React hook.
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Keep the classic hook rules only. react-hooks 7.x ships many
      // React-Compiler-oriented rules that this codebase was not written for,
      // so they are intentionally not enabled here.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.tsx"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Scrollable panel containers use role="region" + aria-label + tabIndex=0
      // so keyboard users can reach overflowing tables without the whole page
      // scrolling sideways. That role is an intentional focus target here.
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        {
          roles: ["region"],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Underscore-prefixed identifiers are an explicit "intentionally unused"
      // convention across the codebase (e.g., not-bound desk methods).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["scripts/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.e2e.test.{ts,tsx}",
      "**/test/support/**",
      "**/tests/**/helpers.ts",
    ],
    rules: {
      // Tests and their support helpers intentionally assert on untyped stubs
      // and edge cases.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
