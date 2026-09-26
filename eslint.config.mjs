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
      "CallExpression[callee.property.name='endsWith'][arguments.0.value=/\\.xslt?$/], BinaryExpression[operator=/^[!=]={1,2}$/] > Literal[value=/\\.xslt?$/]",
    message:
      "What names a stylesheet is SUFFIXES in src/xslint.js and nowhere else, asked through suffixed: one hard-coded suffix at the discovery filter left a stylesheet named .xslt invisible, so naming it on the command line printed 'Processed files: 0' and 'No defects found' over a file nothing had read, where the same bytes named .xsl drew four defects (#924). What counts is a string ending in one of the two, not one spelling it alone: three sweeps over this repository's own fixtures carried the same literal and would have missed such a file the same way, and the third carried it inside a composite, .fixed.xsl, which an anchored selector walked straight past"
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
    "The version in force at a node is derived by climbing to the root, so it is asked once per node — by expressionsOf, which is climbing them anyway — and read off the {node, start, expression, pattern, version} record after that. parseOf asked it in front of the parse memo, so every gathered, textOf, calls and isValid the expression tier issued paid a fresh climb: 950,645 of them over DocBook-XSL, dearer than twenty-one of the twenty-four stages a run is made of (#845). Take found.version, and where a linter holds a node and no record — the DOM tier, which reads a walk rather than an expression — name its file beside src/attributes.js in the group below, where src/xsl-version.js stands too, a module barred from asking the question it answers being a rule about nothing (#851)"
};

const QUOTED = {
  selector:
    "CallExpression[callee.property.name='slice'][arguments.length=2][arguments.0.value=1][arguments.1.operator='-'][arguments.1.argument.value=1]",
  message:
    "What a string literal holds is unquoted in src/tokens.js and nowhere else: cutting the delimiters off is half the answer, and the half a respelling drops is the doubling XPath escapes a quote with, so 'it''s' comes back holding two of them (#851). Three modules wanted it — src/syntax.js for a literal of a parse, src/predicates.js for one of a served predicate, src/expressions.js for the whole value of a shadow attribute — which is one answer, not three"
};

const GRADED = {
  selector:
    "Property[key.name='suggestion'][value.type='Literal']",
  message:
    "Which tier a fix lands in is the check's fix: in its own YAML and nowhere else, src/xslint.js stamping every defect from what the check declares: sixteen linters and fixers asserted a tier beside it, so what a check said and what a user was offered could disagree with nothing in the tree to notice (#899). Declare it in the check and let the run read it. src/linters/double-slash-linter.js is the one exemption, starts-with-double-slash being safe in a @select and a suggestion on an xsl:template whose priority a dropped // shifts, which is a property of the place a defect stands rather than of the check (#583)"
};

const WIDENED = {
  selector:
    "TemplateElement[value.cooked=/ \\*$/]",
  message:
    "What a namespace's every-element bucket is keyed by is EVERY in src/tree.js and nowhere else: the walk keyed it with a literal '*' while src/selectors.js read that key back through the constant, so the two had to agree and nothing held them together — changing EVERY turned eight tests red across test/selectors.test.js and test/predicates.test.js, every one of them naming a union or a wildcard that had stopped merging and not one of them naming the file that spelled the literal (#893)"
};

const HOMED = {
  selector:
    "VariableDeclarator[init.value='*'], " +
    "VariableDeclarator[init.quasis.length=1][init.quasis.0.value.cooked='*']",
  message:
    "Where the constant naming every name there is lives is src/tree.js and nowhere else: src/selectors.js kept an EVERY of its own while the walk keyed its bucket with a literal, so one key wore two spellings a file apart and a drift between them was reported by nothing — WIDENED beside this one bans the literal, which is how the key is written rather than where the constant belongs, so the defect this ticket is named after goes back in under its own title unless a second declaration is refused too (#893)"
};

const SPAWNED = {
  selector:
    "CallExpression[callee.name='require'][arguments.0.value='child_process'], ImportDeclaration[source.value='child_process'], ImportExpression[source.value='child_process']",
  message:
    "Only src/gitignore.js starts a process, and once per repository: what it asks git for is the index, which outranks every rule a .gitignore holds and which no file on disk answers (#929). Asking git about a path instead spends a fork per entry and answers nothing at all where git is absent or the tree is no repository, so everything else here reads files"
};

const PREFIXED = {
  selector:
    "Literal[value=/<\\/?xsl:/], TemplateElement[value.cooked=/<\\/?xsl:/]",
  message:
    "Which prefix an XSLT element is written under is the document's to choose, so code spelling one reads it with lookupPrefix and writes nothing where the namespace is bound to none: textOutsideXslText put a literal <xsl:text> into TEI's simple/mapatts.xsl, which binds XSLT to XSL and binds nothing at all to xsl, and a file every processor loaded before the run was one no parser read after it (#976). missingVersion, sixty lines above it in the same module, had read the prefix since #608"
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
      "local/no-wrapped-concatenation": "error",
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
          VERSIONED, GRADED, QUOTED, WIDENED,
          HOMED, SPAWNED, PREFIXED]
    }
  },
  {
    files: ["src/xslint.js"],
    rules: {
      "no-restricted-syntax": ["error", ...RESTRICTED, SPAWNED, PREFIXED]
    }
  },
  {
    files: ["src/gitignore.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, CLASSED,
          VERSIONED, GRADED, QUOTED, WIDENED,
          HOMED, PREFIXED]
    }
  },
  {
    files: ["src/tree.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, CLASSED,
          VERSIONED, GRADED, QUOTED, WIDENED, SPAWNED, PREFIXED]
    }
  },
  {
    files: ["src/linters/double-slash-linter.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, CLASSED,
          VERSIONED, QUOTED, WIDENED,
          HOMED, SPAWNED, PREFIXED]
    }
  },
  {
    files: ["src/attributes.js", "src/xsl-version.js",
      "src/conditions.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, CLASSED,
          GRADED, QUOTED, WIDENED,
          HOMED, SPAWNED, PREFIXED]
    }
  },
  {
    files: ["src/tokens.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, CLASSED, VERSIONED, GRADED, WIDENED,
          HOMED, SPAWNED, PREFIXED]
    }
  },
  {
    files: ["src/grammar.js", "src/syntax.js"],
    rules: {
      "no-restricted-syntax":
        ["error", ...RESTRICTED, STAGED, OPAQUE, TRIVIA, PAIRED, VERSIONED,
          GRADED, QUOTED, WIDENED,
          HOMED, SPAWNED, PREFIXED]
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { sourceType: "module" }
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ignores: ["test/**"],
    rules: {
      "max-lines": ["error", {
        max: 1000,
        skipBlankLines: false,
        skipComments: false
      }]
    }
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
