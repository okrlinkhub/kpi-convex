import convexPlugin from "@convex-dev/eslint-plugin";
import pluginJs from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "example/dist/**", "example/.next/**", "**/_generated/**", "*.config.*"] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "example/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: ["./tsconfig.json", "./example/tsconfig.json", "./example/convex/tsconfig.json"], tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["src/component/**/*.ts", "example/convex/**/*.ts"],
    languageOptions: { globals: globals.worker },
    plugins: { "@convex-dev": convexPlugin },
    rules: {
      ...convexPlugin.configs.recommended[0].rules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["src/react/**/*.{ts,tsx}", "example/app/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }]
    }
  }
];
