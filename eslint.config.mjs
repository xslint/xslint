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
    selector: "CallExpression[callee.property.name='push'] > SpreadElement",
    message:
      "Do not grow an array by spreading into push: a spread hands every element over as an argument, and V8 caps those at roughly 125 per kilobyte of stack, so a directory of 125k files took the whole run down with a RangeError before a byte of XSL was read (#758). Concatenate the list instead — concat, flatMap, or an array literal — none of which spends an argument per element"
  },
  {
    selector: "Literal[value=/\\/\\/@/]",
    message:
      "Do not select attributes with a bare '//@name' XPath, which reads a literal result element as XPath; a linter is handed the expressions the validator kept, and narrows one out of them with whole(found, name) from src/attributes.js"
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
      "Do not spell a node and its text as two arguments of defect (#648); hand it the {node, start, expression} record that expressionsOf yields"
  },
  {
    selector:
      "BinaryExpression[operator='-'][left.property.name='columnNumber'][right.property.name='length']",
    message:
      "Do not work out where an attribute stands by subtracting a name's length from columnNumber, which xmldom reports at the opening delimiter of the value, so every gap XML allows around the '=' moves one and not the other (#594, #681, #718). Ask the source through src/fixes.js: standsAt for where it stands, substitution for a fix that rewrites its value, deletion for one that cuts it"
  },
  {
    selector:
      "Property[key.name='value'] > TemplateLiteral, Property[key.name='value'] > BinaryExpression[operator='+']",
    message:
      "A fix's 'value' is the text the source already holds, so read it from there rather than spelling it out (#793). src/linters/import-linter.js built an element's as an indentation repeated columnNumber times plus a tag rebuilt from its name and its href, which assumed a gap, a delimiter and an empty-tag spelling all at once and so matched one file in seven. Ask src/fixes.js: excision for a fix that cuts a whole element, deletion for one that cuts an attribute, substitution for one that rewrites a value"
  },
  {
    selector:
      "CallExpression[callee.object.name='process'][callee.property.name='exit']",
    message:
      "Do not end a run with process.exit, which abandons whatever stdout has not taken: node writes to a pipe asynchronously on POSIX, so a report going anywhere but a terminal lost its tail and, past the buffer, every line of it (#767). Set process.exitCode and let the process end once its writes are done"
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

const PAIRED = {
  selector:
    "CallExpression[callee.object.name='usages'][callee.property.name=/^(some|every|filter|map|flatMap|find)$/] CallExpression[callee.name='referencing']",
  message:
    "The names a usage value references depend on that value and the check's template alone, so reading them inside a per-declaration scan of the usages reads them once per (declaration, usage) pair: that product is 1207 names against 72,077 attributes over DocBook-XSL, and 98% of what this stage spent. Build the index once with indexed and ask it for the declaration's name (#755, #783)"
};

const TRIVIA = {
  selector:
    ":matches(ArrayExpression, LogicalExpression):has(MemberExpression[object.name='TOKENS'][property.name='WHITESPACE']):has(MemberExpression[object.name='TOKENS'][property.name='COMMENT'])",
  message:
    "Which kinds carry no meaning to a grammar and every meaning to the source is TRIVIA in src/tokens.js and nowhere else: it was spelled three times over — as TRIVIA in src/grammar.js, as a && chain inside tokenized, and once more in lone — which is how OPAQUE came to be missing a kind (#576, #708)"
};

const CLASSED = {
  selector:
    ":matches(ArrayExpression, LogicalExpression):has(Literal[value='comparison']):has(Literal[value='value-comparison'])",
  message:
    "Which kinds a comparison of two values comes back as is VALUED in src/syntax.js and nowhere else, src/grammar.js excepted, which mints the kinds: the general and the value comparison are two kinds and one question, and a check knowing only the first is blind to every 2.0 stylesheet written in the second (#763, #575). Two copies of a kind list are a kind missing from one of them, which is what OPAQUE and TRIVIA are each one list for"
};

const VERSIONED = {
  selector:
    "CallExpression[callee.name='versionOf'], ObjectPattern > Property[key.name='versionOf']",
  message:
    "The version in force at a node is derived by climbing to the root, so it is asked once per node — by expressionsOf, which is climbing them anyway — and read off the {node, start, expression, pattern, version} record after that. parseOf asked it in front of the parse memo, so every gathered, textOf, calls and isValid the expression tier issued paid a fresh climb: 950,645 of them over DocBook-XSL, dearer than twenty-one of the twenty-four stages a run is made of (#845). Take found.version, and where a linter holds a node and no record — the DOM tier, which reads a walk rather than an expression — name its file beside src/attributes.js in the group below"
};

const SPRAWLING = ["src/grammar.js"];

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
      "local/no-sprawling-docblock":
        ["error", { description: 5, tag: 3 }],
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
      "max-lines": ["error", {
        max: 1000,
        skipBlankLines: false,
        skipComments: false
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
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, CLASSED,
          VERSIONED]
    }
  },
  {
    files: ["src/attributes.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, CLASSED]
    }
  },
  {
    files: ["src/tokens.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, CLASSED, VERSIONED]
    }
  },
  {
    files: ["src/grammar.js", "src/syntax.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, VERSIONED]
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { sourceType: "module" }
  },
  {
    files: SPRAWLING,
    rules: {
      "max-lines": "off"
    }
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
