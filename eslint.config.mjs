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

const RESTRICTED = [
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
    selector: "Literal[regex.pattern=/\\\\s/], Literal[value=/\\\\s/], TemplateElement[value.cooked=/\\\\s/]",
    message:
      "Do not spell a whitespace gap as \\s: JavaScript's class is wider than the XML S that XPath and XSLT mean, so it reads a gap where the grammar has none. Use GAP (or WHITESPACE) from src/tokens.js"
  },
  {
    selector: "Literal[value=/\\/\\/@/]",
    message:
      "Do not select attributes with a bare '//@name' XPath, which reads a literal result element as XPath; go through src/attributes.js (expressionsOf, selectorOf)"
  },
  {
    selector:
      "IfStatement CallExpression[callee.name=/^(it|describe)$/], ConditionalExpression CallExpression[callee.name=/^(it|describe)$/]",
    message:
      "Register the test and skip it in its body with this.skip(); a test registered behind a condition disappears without a word, the way 249 xcop assertions did (#645)"
  },
  {
    selector:
      "MemberExpression[object.name='expression'][property.name=/^(nodeValue|nodeName|nodeType|localName|lineNumber|columnNumber|ownerElement)$/]",
    message:
      "'expression' names the text of an expression, never the node carrying it (#648). A node has no place under that name: call it 'attribute', or pass the whole {node, start, expression} record"
  },
  {
    selector:
      "CallExpression[callee.name='defect'] MemberExpression[property.name='nodeValue']",
    message:
      "Do not spell a node and its text as two arguments of defect (#648); hand it the {node, start, expression} record that expressionsOf yields, or wholeOf(attribute) for a narrowed one"
  },
  {
    selector:
      "CallExpression[callee.property.name='getAttribute'][callee.object.property.name='documentElement'][arguments.0.value='version']",
    message:
      "Read the stylesheet version through versionOf in src/xsl-version.js, which handles a simplified stylesheet's xsl:version; do not read documentElement.getAttribute('version') directly"
  }
];

export default defineConfig([
  { ignores: ["eslint.config.mjs", "docs/**"] },
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
      "local/no-missing-arguments": "error",
      "local/no-multiple-returns": "error",
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
      "no-ternary": "error",
      "id-length": ["error", { min: 2 }],
      "no-restricted-syntax": ["error", ...RESTRICTED]
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
    files: ["src/**/*.js", "src/**/*.mjs"],
    ignores: ["src/xslint.js"],
    rules: {
      "no-restricted-syntax": ["error", ...RESTRICTED,
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.value=/-(linter|validator)(\\.js)?$/], ImportDeclaration[source.value=/-(linter|validator)(\\.js)?$/], ImportExpression[source.value=/-(linter|validator)(\\.js)?$/]",
          message:
            "Only src/xslint.js wires a stage: no linter or validator reads another, and no core module reaches into the pipeline it exists to serve (#715)"
        }
      ]
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { sourceType: "module" }
  },
  {
    files: ["eslint-local-rules.js"],
    rules: {
      "comma-dangle": "off",
      "local/no-multiple-returns": "off",
      "object-curly-spacing": "off",
      "quote-props": "off",
      quotes: "off",
      semi: "off",
      "space-before-function-paren": "off"
    }
  }
]);
