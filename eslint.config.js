/** @format */

import globals from "globals";
import jslint from "@eslint/js";
import tslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { sortImportsByLength } from "./rules.eslintrc.js";

export default defineConfig([
  jslint.configs.recommended,
  ...tslint.configs.recommended,
  { linterOptions: { noInlineConfig: true } },
  { languageOptions: { globals: globals.node } },
  {
    plugins: { custom: { rules: { _: sortImportsByLength } } },
    rules: { "custom/_": "warn", "@typescript-eslint/consistent-type-imports": "warn" }
  }
]);
