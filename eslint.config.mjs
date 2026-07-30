/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

import { defineConfig } from "eslint/config";
import path from "path";
import { fileURLToPath } from "url";
import js from "@eslint/js";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";
import { FlatCompat } from "@eslint/eslintrc";
import local from "./eslint-local-rules.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([
  { ignores: ["eslint.config.mjs", "eslint-local-rules.js", "docs/**"] },
  js.configs.recommended,
  ...compat.extends("google"),
  jsdoc.configs["flat/recommended-error"],
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.mocha },
      ecmaVersion: 2022,
      sourceType: "commonjs"
    },
    settings: {
      jsdoc: {
        tagNamePreference: { returns: "return" }
      }
    },
    plugins: { "@stylistic": stylistic, local },
    rules: {
      "local/no-redundant-return-variable": "error",
      "valid-jsdoc": "off",
      "require-jsdoc": "off",
      semi: ["error", "never"],
      "comma-dangle": ["error", "always-multiline"],
      indent: ["error", 2],
      camelcase: ["error", { properties: "never" }],
      "max-len": ["error", {
        code: 80,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true
      }],
      "jsdoc/no-undefined-types": [
        "error",
        { definedTypes: ["Document", "Node", "Element"] }
      ],
      "jsdoc/reject-any-type": "off",
      "@stylistic/space-infix-ops": "error",
      "id-length": ["error", { min: 2 }],
      "no-restricted-syntax": ["error",
        {
          selector: "UpdateExpression[prefix=true]",
          message: "Use postfix increment/decrement (x++), not prefix (++x)"
        },
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.value=/^node:/]",
          message:
            "Do not use the 'node:' prefix in require; use the bare name"
        },
        {
          selector: "ImportDeclaration[source.value=/^node:/]",
          message:
            "Do not use the 'node:' prefix in import; use the bare name"
        },
        {
          selector: "Literal[value=/\\/\\/@/]",
          message:
            "Do not select attributes with a bare '//@name' XPath, which reads a literal result element as XPath; go through src/attributes.js (expressionsOf, selectorOf)"
        }
      ]
    }
  },
  {
    files: ["src/**/*.js", "src/**/*.mjs"],
    rules: {
      "jsdoc/require-jsdoc": ["error", {
        require: { FunctionDeclaration: true, FunctionExpression: true }
      }]
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { sourceType: "module" }
  }
]);
