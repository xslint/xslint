/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const path = require("path");

// How many arguments a caller must supply: every parameter up to the first one
// that carries a default or collects the rest.
const required = function (params) {
  const optional = params.findIndex(
    (par) => par.type === "AssignmentPattern" || par.type === "RestElement"
  );
  let count = optional;
  if (optional === -1) {
    count = params.length;
  }
  return count;
};

// The parameter list of the function a binding holds, when that function is
// written out in the very file being linted, or null when it is not.
const written = function (def) {
  if (def.node.type === "FunctionDeclaration") {
    return def.node.params;
  }
  if (
    def.node.type === "VariableDeclarator" &&
    def.node.init &&
    (def.node.init.type === "FunctionExpression" ||
      def.node.init.type === "ArrowFunctionExpression")
  ) {
    return def.node.init.params;
  }
  return null;
};

// The module a `const ... = require('./somewhere')` binding pulls in, loaded
// from disk relative to the file being linted. Only a project-local path is
// followed, so no third-party signature is ever second-guessed, and anything
// that fails to resolve or to load leaves the call unjudged.
const loaded = function (def, from) {
  let init = null;
  if (def.node.type === "VariableDeclarator") {
    init = def.node.init;
  }
  if (
    !init ||
    init.type !== "CallExpression" ||
    init.callee.name !== "require" ||
    init.arguments.length !== 1 ||
    init.arguments[0].type !== "Literal" ||
    typeof init.arguments[0].value !== "string" ||
    !init.arguments[0].value.startsWith(".")
  ) {
    return null;
  }
  try {
    return require(path.resolve(path.dirname(from), init.arguments[0].value));
  } catch {
    return null;
  }
};

// The name a destructured binding takes out of its module — `defect` out of
// `const {defect} = require('./checks')` — or null when the binding is the
// whole module.
const taken = function (def) {
  if (
    def.node.type !== "VariableDeclarator" ||
    def.node.id.type !== "ObjectPattern"
  ) {
    return null;
  }
  const property = def.node.id.properties.find(
    (pro) => pro.type === "Property" && pro.value === def.name
  );
  let name = null;
  if (property && property.key.type === "Identifier") {
    name = property.key.name;
  }
  return name;
};

// The variable a name resolves to at a scope, respecting shadowing.
const bound = function (scope, name) {
  for (let current = scope; current; current = current.upper) {
    const found = current.variables.find((va) => va.name === name);
    if (found) {
      return found;
    }
  }
  return null;
};

// How many arguments the function a variable holds demands, or null when the
// variable holds something this rule cannot read: a value that is not a
// function, one that arrives from outside the project, or a member of a
// binding that is itself only a piece of its module.
const demanded = function (variable, from, key) {
  if (!variable || variable.defs.length !== 1) {
    return null;
  }
  const def = variable.defs[0];
  let params = null;
  if (key === null) {
    params = written(def);
  }
  if (params) {
    return required(params);
  }
  if (key !== null && taken(def) !== null) {
    return null;
  }
  const target = loaded(def, from);
  if (target === null) {
    return null;
  }
  let name = key;
  if (key === null) {
    name = taken(def);
  }
  let fun = target;
  if (name !== null) {
    fun = target[name];
  }
  let arity = null;
  if (typeof fun === "function") {
    arity = fun.length;
  }
  return arity;
};

// Whether a comment is a JSDoc block — `/** ... */` — rather than a plain
// block comment or a line comment, a null standing for nothing there at all.
const documents = function (comment) {
  return (
    comment !== null &&
    comment.type === "Block" &&
    comment.value.startsWith("*")
  );
};

// The lines a docblock says, its delimiters and leading stars off and its blank
// separators dropped, each paired with the source line it stands on: what a
// reader is charged for, and where to point when there is too much of it.
const worded = function (comment) {
  return comment.value
    .split("\n")
    .map(function (line, index) {
      let text = line.trim();
      if (text.startsWith("*")) {
        text = text.slice(1).trim();
      }
      return { text, at: comment.loc.start.line + index };
    })
    .filter((one) => one.text !== "");
};

// What a block says, parted into its description and one entry per tag, an
// entry being the tag line and every line it wraps onto: a wrapped @param is
// one thing a reader reads and not three of them.
const parted = function (comment) {
  const entries = [];
  worded(comment).forEach(function (one) {
    if (entries.length === 0 || one.text.startsWith("@")) {
      let tag = null;
      if (one.text.startsWith("@")) {
        tag = one.text.split(" ")[0];
      }
      entries.push({ tag, lines: [] });
    }
    entries[entries.length - 1].lines.push(one);
  });
  return entries;
};

// A project-local ESLint plugin, kept out of eslint.config.mjs so it can be
// unit-tested with ESLint's RuleTester (test/eslint-local-rules.test.js). One
// rule flags a variable whose only purpose is to be returned by the very next
// statement — that binding is redundant and should be inlined. Another flags
// a call that leaves out an argument the callee declares. The third flags a
// function that can be left through more than one return, where the branching,
// not the exit, is what should carry the choice. The fourth flags a docblock
// standing in front of another, which documents nothing, and the last weighs
// what one docblock says, a file being capped at 1000 lines while the comments
// inside it answered to nothing. No plugin dependency is needed; a single
// no-restricted-syntax selector can neither compare a declaration's name with
// the identifier the following return uses, nor weigh a call's argument count
// against the parameter list of the callee, nor tell which function a return
// belongs to, nor count the lines of a comment, which is no node at all.
module.exports = {
  rules: {
    "no-redundant-return-variable": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "disallow a variable that only exists to be returned next"
        },
        messages: {
          redundant:
            "Return the expression directly instead of binding it to a " +
            "variable first"
        }
      },
      create(context) {
        return {
          ReturnStatement(node) {
            const block = node.parent;
            if (
              !node.argument ||
              node.argument.type !== "Identifier" ||
              block.type !== "BlockStatement"
            ) {
              return;
            }
            const prev = block.body[block.body.indexOf(node) - 1];
            if (
              prev &&
              prev.type === "VariableDeclaration" &&
              prev.declarations.length === 1 &&
              prev.declarations[0].id.type === "Identifier" &&
              prev.declarations[0].id.name === node.argument.name
            ) {
              context.report({ node: prev, messageId: "redundant" });
            }
          }
        };
      }
    },
    "no-missing-arguments": {
      meta: {
        type: "problem",
        docs: {
          description:
            "disallow a call that leaves out an argument the callee demands"
        },
        messages: {
          missing:
            "Pass every argument of '{{name}}': {{expected}} expected, " +
            "{{given}} given"
        }
      },
      create(context) {
        return {
          CallExpression(node) {
            const callee = node.callee;
            const named =
              callee.type === "Identifier" ||
              (callee.type === "MemberExpression" &&
                !callee.computed &&
                callee.object.type === "Identifier" &&
                callee.property.type === "Identifier");
            if (
              !named ||
              node.arguments.some((arg) => arg.type === "SpreadElement")
            ) {
              return;
            }
            let holder = callee;
            let key = null;
            if (callee.type !== "Identifier") {
              holder = callee.object;
              key = callee.property.name;
            }
            const expected = demanded(
              bound(context.sourceCode.getScope(node), holder.name),
              context.filename,
              key
            );
            if (expected !== null && node.arguments.length < expected) {
              context.report({
                node,
                messageId: "missing",
                data: {
                  name: context.sourceCode.getText(callee),
                  expected,
                  given: node.arguments.length
                }
              });
            }
          }
        };
      }
    },
    "no-orphan-docblock": {
      meta: {
        type: "problem",
        docs: {
          description: "disallow a JSDoc block with no declaration under it"
        },
        messages: {
          orphan:
            "This block documents nothing: another JSDoc block stands where " +
            "the declaration it describes should be, so whatever it " +
            "documented has gone and the block outlived it"
        }
      },
      create(context) {
        const source = context.sourceCode;
        return {
          Program() {
            source
              .getAllComments()
              .filter(
                (comment) =>
                  documents(comment) &&
                  documents(
                    source.getTokenAfter(comment, { includeComments: true })
                  )
              )
              .forEach((comment) =>
                context.report({ node: comment, messageId: "orphan" })
              );
          }
        };
      }
    },
    "no-sprawling-docblock": {
      meta: {
        type: "suggestion",
        docs: {
          description: "cap how many lines one JSDoc block may spend"
        },
        messages: {
          sprawling:
            "Cut this description to {{max}} lines or fewer: it spends " +
            "{{spent}}, and the derivation behind a module belongs in the " +
            "CLAUDE.md of the directory it sits in",
          wordy:
            "Cut '{{tag}}' to {{max}} lines or fewer: it spends {{spent}}"
        },
        schema: [
          {
            type: "object",
            properties: {
              description: { type: "integer", minimum: 1 },
              tag: { type: "integer", minimum: 1 }
            },
            additionalProperties: false
          }
        ]
      },
      create(context) {
        const caps = { description: 5, tag: 3, ...context.options[0] };
        return {
          Program() {
            context.sourceCode
              .getAllComments()
              .filter(documents)
              .flatMap(parted)
              .forEach(function (entry) {
                let max = caps.description;
                let messageId = "sprawling";
                if (entry.tag !== null) {
                  max = caps.tag;
                  messageId = "wordy";
                }
                if (entry.lines.length > max) {
                  context.report({
                    loc: { line: entry.lines[max].at, column: 0 },
                    messageId,
                    data: { max, spent: entry.lines.length, tag: entry.tag }
                  });
                }
              });
          }
        };
      }
    },
    "no-multiple-returns": {
      meta: {
        type: "suggestion",
        docs: {
          description: "disallow more than one return statement in a function"
        },
        messages: {
          multiple:
            "Return once from a function; let the branching decide the " +
            "value, not the exit"
        }
      },
      create(context) {
        const walked = [];
        const entered = function () {
          walked.push([]);
        };
        const exited = function () {
          walked
            .pop()
            .slice(1)
            .forEach(
              (ret) => context.report({ node: ret, messageId: "multiple" })
            );
        };
        return {
          FunctionDeclaration: entered,
          FunctionExpression: entered,
          ArrowFunctionExpression: entered,
          "FunctionDeclaration:exit": exited,
          "FunctionExpression:exit": exited,
          "ArrowFunctionExpression:exit": exited,
          ReturnStatement(node) {
            if (walked.length > 0) {
              walked[walked.length - 1].push(node);
            }
          }
        };
      }
    }
  }
};
