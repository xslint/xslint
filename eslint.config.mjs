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
      "BinaryExpression[operator='-'][left.property.name='columnNumber'][right.property.name='length']",
    message:
      "Do not work out where an attribute stands by subtracting a name's length from columnNumber, which xmldom reports at the opening delimiter of the value, so every gap XML allows around the '=' moves one and not the other (#594, #681, #718). Ask the source through src/fixes.js: standsAt for where it stands, substitution for a fix that rewrites its value, deletion for one that cuts it"
  },
  {
    selector:
      "CallExpression[callee.property.name='getAttribute'][callee.object.property.name='documentElement'][arguments.0.value='version']",
    message:
      "Read the stylesheet version through versionOf in src/xsl-version.js, which handles a simplified stylesheet's xsl:version; do not read documentElement.getAttribute('version') directly"
  }
];

const STAGED = {
  selector:
    "CallExpression[callee.name='require'][arguments.0.value=/-(linter|validator)(\\.js)?$/], ImportDeclaration[source.value=/-(linter|validator)(\\.js)?$/], ImportExpression[source.value=/-(linter|validator)(\\.js)?$/]",
  message:
    "Only src/xslint.js wires a stage: no linter or validator reads another, and no core module reaches into the pipeline it exists to serve (#715)"
};

const OPAQUE = {
  selector:
    ":matches(ArrayExpression, LogicalExpression):has(MemberExpression[object.name='TOKENS'][property.name='STRING']):has(MemberExpression[object.name='TOKENS'][property.name='COMMENT'])",
  message:
    "Which kinds a scan reads over rather than into is OPAQUE in src/tokens.js and nowhere else: spelling the list out again is how the literal that never closes reached masked and inside as a kind neither of them named, and two checks began reporting inside a string (#708)"
};

const TRIVIA = {
  selector:
    ":matches(ArrayExpression, LogicalExpression):has(MemberExpression[object.name='TOKENS'][property.name='WHITESPACE']):has(MemberExpression[object.name='TOKENS'][property.name='COMMENT'])",
  message:
    "Which kinds carry no meaning to a grammar and every meaning to the source is TRIVIA in src/tokens.js and nowhere else: it was spelled three times over — as TRIVIA in src/grammar.js, as a && chain inside tokenized, and once more in lone — which is how OPAQUE came to be missing a kind (#576, #708)"
};

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
      "local/no-orphan-docblock": "error",
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
      "no-restricted-syntax": ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA]
    }
  },
  {
    files: ["src/tokens.js"],
    rules: {
      "no-restricted-syntax": ["error", ...RESTRICTED, STAGED]
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
