/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {deletion} = require('./fixes')

/**
 * Fix for `using-disable-output-escaping`: delete the attribute. Removing it
 * changes how the output is escaped, so it is a suggestion.
 * @param {Element} node - The element carrying the attribute
 * @param {string} content - Raw source text of the file it stands in
 * @return {object} - The suggestion fix
 */
const disableOutputEscaping = function(node, content) {
  return {
    ...deletion(node.getAttributeNode('disable-output-escaping'), content),
    suggestion: true,
  }
}

/**
 * Fix for `output-method-xml`: switch the method to `html`. It changes the
 * serialization, so it is a suggestion.
 * @param {Element} node - The `xsl:output` element
 * @return {object} - The suggestion fix
 */
const outputMethodXml = function(node) {
  const method = node.getAttributeNode('method')
  return {
    line: method.lineNumber,
    col: method.columnNumber + 1,
    value: 'xml',
    replacement: 'html',
    suggestion: true,
  }
}

/**
 * Fix for `missing-version-in-stylesheet`: declare `version="1.0"` right after
 * the element name. The version is a guess, so it is a suggestion.
 * @param {Element} node - The `xsl:stylesheet` element
 * @return {object} - The suggestion fix
 */
const missingVersion = function(node) {
  return {
    line: node.lineNumber,
    col: node.columnNumber + node.nodeName.length + 1,
    value: '',
    replacement: ' version="1.0"',
    suggestion: true,
  }
}

/**
 * Fix for `mode-or-priority-without-match`: delete the orphan attribute. It is
 * one of two corrections the rule offers (the other is adding `match`), so it
 * is a suggestion, and only when exactly one of `mode`/`priority` is present
 * can a single deletion resolve the defect — with both, there is no fix.
 * @param {Element} node - The `xsl:template` element
 * @param {string} content - Raw source text of the file it stands in
 * @return {?object} - The suggestion fix, or null
 */
const modeOrPriority = function(node, content) {
  const present = ['mode', 'priority'].filter((name) => node.hasAttribute(name))
  let fix = null
  if (present.length === 1) {
    fix = {
      ...deletion(node.getAttributeNode(present[0]), content),
      suggestion: true,
    }
  }
  return fix
}

/**
 * Fix for `starts-with-double-slash`: drop the leading `//` of a pattern
 * attribute. The same nodes match afterwards, since a pattern is unanchored
 * either way — but on an `xsl:template` they do not match at the same *rank*: a
 * pattern carrying a `/` step has a default priority of 0.5 where a lone name
 * test has 0, so the rule loses half a point against every rule it competes
 * with and a template that used to win can start losing (#583). That is a
 * behaviour change, so there the edit is a suggestion.
 *
 * Nowhere else is it one. `priority` is an attribute of `xsl:template` alone,
 * so no other pattern is ranked against anything: an `xsl:key` or `xsl:number`
 * pattern only selects, an `xsl:for-each-group` pattern only tests membership,
 * and `xsl:accumulator-rule` resolves a clash by declaration order. Dropping
 * the `//` there is deterministic and semantics-preserving, which is a safe
 * fix, and tiering every kind as a suggestion would withhold five of the six
 * from `--fix` for a hazard only the sixth has.
 *
 * The `//` is cut where it truly stands rather than off the front, because the
 * check reads the pattern normalized: on `match=" //spaced"` slicing two
 * characters would leave `/spaced`, turning an unanchored pattern into an
 * absolute one.
 * @param {Node} pattern - The pattern attribute node
 * @return {object} - The fix, a suggestion only inside a template
 */
const startsWithDoubleSlash = function(pattern) {
  const at = pattern.value.indexOf('//')
  let tier = {}
  if (pattern.ownerElement.localName === 'template') {
    tier = {suggestion: true}
  }
  return {
    line: pattern.lineNumber,
    col: pattern.columnNumber - pattern.name.length - 1,
    value: `${pattern.name}="${pattern.value}"`,
    replacement: `${pattern.name}="${
      pattern.value.slice(0, at)}${pattern.value.slice(at + 2)}"`,
    ...tier,
  }
}

/**
 * Fix for `incorrect-use-of-boolean-constants`: replace the string literal
 * test `'true'`/`'false'` with the boolean `true()`/`false()`. A suggestion,
 * since `'false'` is a non-empty string that is always true, so the rewrite
 * changes the test's truth value — which is the point.
 * @param {Element} node - The `xsl:if`/`xsl:when` element
 * @return {object} - The suggestion fix
 */
const booleanConstant = function(node) {
  const test = node.getAttributeNode('test')
  let constant = 'false()'
  if (test.value.includes('true')) {
    constant = 'true()'
  }
  return {
    line: test.lineNumber,
    col: test.columnNumber - test.name.length - 1,
    value: `${test.name}="${test.value}"`,
    replacement: `${test.name}="${constant}"`,
    suggestion: true,
  }
}

/**
 * Fix for `select-starts-with-double-slash`: anchor the leading `//` of a
 * `@select` as `.//`, so it scans the context node's descendants rather than
 * the whole document. A suggestion, since it changes behaviour (absolute to
 * relative) and `.//` is one of several valid anchors.
 * @param {Element} node - The element carrying the `@select`
 * @return {object} - The suggestion fix
 */
const selectDoubleSlash = function(node) {
  const select = node.getAttributeNode('select')
  const at = select.value.indexOf('//')
  return {
    line: select.lineNumber,
    col: select.columnNumber - select.name.length - 1,
    value: `${select.name}="${select.value}"`,
    replacement:
      `${select.name}="${select.value.slice(0, at)}.${select.value.slice(at)}"`,
    suggestion: true,
  }
}

/**
 * Fix for `confusing-variable-and-node`: prepend `$` to the bare name in the
 * `xsl:apply-templates` `@select`, turning a node selector into the variable
 * reference the author meant. The rule fires only when the name is at the start
 * of `@select`, so a single insert after the opening quote suffices. A
 * suggestion, since it assumes the variable was intended over a child element.
 * @param {Element} node - The `xsl:apply-templates` element
 * @return {object} - The suggestion fix
 */
const confusingVariable = function(node) {
  const select = node.getAttributeNode('select')
  return {
    line: select.lineNumber,
    col: select.columnNumber - select.name.length - 1,
    value: `${select.name}="`,
    replacement: `${select.name}="$`,
    suggestion: true,
  }
}

/**
 * Fix for `text-outside-xsl-text`: wrap the literal text in `xsl:text`. A
 * suggestion, since it is a stylistic rewrite that inserts an element. Only
 * when the instruction holds exactly one non-whitespace text node can a single
 * edit resolve the defect — with text on both sides of a child element there
 * are several nodes to wrap, so there is no fix.
 * @param {Element} node - The instruction element holding the loose text
 * @return {?object} - The suggestion fix, or null
 */
const textOutsideXslText = function(node) {
  const texts = Array.from(node.childNodes).filter(
    (child) => child.nodeType === 3 && child.nodeValue.trim() !== '',
  )
  let fix = null
  if (texts.length === 1) {
    fix = {
      line: texts[0].lineNumber,
      col: texts[0].columnNumber,
      value: texts[0].nodeValue,
      replacement: `<xsl:text>${texts[0].nodeValue}</xsl:text>`,
      suggestion: true,
    }
  }
  return fix
}

/**
 * Fix for `variable-or-param-with-select-and-content`: delete the `@select`,
 * leaving the body as the only value. It is one of the two corrections the rule
 * offers — dropping the body instead is structural, so no single edit expresses
 * it — and the body binds a tree where the expression bound its own type, so it
 * is a suggestion.
 * @param {Element} node - The variable-binding element
 * @param {string} content - Raw source text of the file it stands in
 * @return {object} - The suggestion fix
 */
const selectAndContent = function(node, content) {
  return {
    ...deletion(node.getAttributeNode('select'), content),
    suggestion: true,
  }
}

/**
 * Fix builders for declarative Xpath checks, keyed by check name. The per-file
 * linter attaches the fix a builder returns to the defect it found for that
 * check, so a rule stays declarative while still carrying a fix; a builder
 * returns null when it cannot resolve the defect with a single edit. Each is
 * handed the raw source alongside the node, since a builder that cuts an
 * attribute reads the span from the text rather than rebuilding it (#594).
 * @type {{[check: string]: function(Node, string): ?object}}
 */
const FIXERS = {
  'using-disable-output-escaping': disableOutputEscaping,
  'output-method-xml': outputMethodXml,
  'missing-version-in-stylesheet': missingVersion,
  'mode-or-priority-without-match': modeOrPriority,
  'starts-with-double-slash': startsWithDoubleSlash,
  'incorrect-use-of-boolean-constants': booleanConstant,
  'select-starts-with-double-slash': selectDoubleSlash,
  'confusing-variable-and-node': confusingVariable,
  'text-outside-xsl-text': textOutsideXslText,
  'variable-or-param-with-select-and-content': selectAndContent,
}

module.exports = {
  FIXERS,
}
