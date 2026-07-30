/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {deletion} = require('./fixes')

/**
 * Fix for `using-disable-output-escaping`: delete the attribute. Removing it
 * changes how the output is escaped, so it is a suggestion.
 * @param {Element} node - The element carrying the attribute
 * @return {object} - The suggestion fix
 */
const disableOutputEscaping = function(node) {
  return {
    ...deletion(node.getAttributeNode('disable-output-escaping')),
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
 * @return {?object} - The suggestion fix, or null
 */
const modeOrPriority = function(node) {
  const present = ['mode', 'priority'].filter((name) => node.hasAttribute(name))
  return present.length === 1 ?
    {...deletion(node.getAttributeNode(present[0])), suggestion: true} :
    null
}

/**
 * Fix for `starts-with-double-slash`: drop the leading `//` of the template's
 * `@match`. The pattern selects the same nodes either way, since a pattern is
 * matched unanchored, but the template's default priority falls from 0.5 to 0
 * once the leading step is gone, handing a conflict to whichever rule it used
 * to tie with — a suggestion, then, rather than a safe fix. A pattern of
 * nothing but the slashes reaches no XPath validator, so it arrives here too;
 * emptying it would trade one broken pattern for another, and it gets no fix.
 * @param {Element} node - The `xsl:template` element
 * @return {?object} - The suggestion fix, or null
 */
const startsWithDoubleSlash = function(node) {
  const match = node.getAttributeNode('match')
  return match.value.length > 2 ?
    {
      line: match.lineNumber,
      col: match.columnNumber - match.name.length - 1,
      value: `${match.name}="${match.value}"`,
      replacement: `${match.name}="${match.value.slice(2)}"`,
      suggestion: true,
    } :
    null
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
  return {
    line: test.lineNumber,
    col: test.columnNumber - test.name.length - 1,
    value: `${test.name}="${test.value}"`,
    replacement:
      `${test.name}="${test.value.includes('true') ? 'true()' : 'false()'}"`,
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
  return texts.length === 1 ?
    {
      line: texts[0].lineNumber,
      col: texts[0].columnNumber,
      value: texts[0].nodeValue,
      replacement: `<xsl:text>${texts[0].nodeValue}</xsl:text>`,
      suggestion: true,
    } :
    null
}

/**
 * Fix for `variable-or-param-with-select-and-content`: delete the `@select`,
 * leaving the body as the only value. It is one of the two corrections the rule
 * offers — dropping the body instead is structural, so no single edit expresses
 * it — and the body binds a tree where the expression bound its own type, so it
 * is a suggestion.
 * @param {Element} node - The variable-binding element
 * @return {object} - The suggestion fix
 */
const selectAndContent = function(node) {
  return {
    ...deletion(node.getAttributeNode('select')),
    suggestion: true,
  }
}

/**
 * Fix builders for declarative Xpath checks, keyed by check name. The per-file
 * linter attaches the fix a builder returns to the defect it found for that
 * check, so a rule stays declarative while still carrying a fix; a builder
 * returns null when it cannot resolve the defect with a single edit.
 * @type {{[check: string]: function(Node): ?object}}
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
