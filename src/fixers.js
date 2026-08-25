/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {deletion, substitution} = require('./fixes')
const {XSLT} = require('./xsl-version')

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
 * Fix for `missing-version-in-stylesheet`: declare the version right after the
 * element name. Which attribute follows the root's *namespace* and not its
 * name — an XSLT element takes a plain `version`, a simplified stylesheet the
 * namespaced one — so forking by name would write a second version onto
 * `xsl:package` (#608). The prefix is read, never assumed.
 * @param {Element} node - The root element of the stylesheet
 * @return {?object} - The suggestion fix, or nothing when none can be spelled
 */
const missingVersion = function(node) {
  let spelled = 'version'
  if (node.namespaceURI !== XSLT) {
    spelled = ''
    const prefix = node.lookupPrefix(XSLT)
    if (prefix) {
      spelled = `${prefix}:version`
    }
  }
  let fix = undefined
  if (spelled) {
    fix = {
      line: node.lineNumber,
      col: node.columnNumber + node.nodeName.length + 1,
      value: '',
      replacement: ` ${spelled}="1.0"`,
      suggestion: true,
    }
  }
  return fix
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
 * Fix for `incorrect-use-of-boolean-constants`: replace the string literal
 * test `'true'`/`'false'` with the boolean `true()`/`false()`. A suggestion,
 * since `'false'` is a non-empty string that is always true, so the rewrite
 * changes the test's truth value — which is the point.
 * @param {Element} node - The `xsl:if`/`xsl:when` element
 * @param {string} content - Raw source text of the file it stands in
 * @return {object} - The suggestion fix
 */
const booleanConstant = function(node, content) {
  const test = node.getAttributeNode('test')
  let constant = 'false()'
  if (test.value.includes('true')) {
    constant = 'true()'
  }
  return {
    ...substitution(test, constant, content),
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
 * linter attaches the fix a builder returns to the defect it found, so a rule
 * stays declarative while carrying a fix; a builder returns null when one edit
 * cannot resolve the defect. Each is handed the raw source, a builder that
 * cuts an attribute reading the span from the text (#594).
 * @type {{[check: string]: function(Node, string): ?object}}
 */
const FIXERS = {
  'using-disable-output-escaping': disableOutputEscaping,
  'missing-version-in-stylesheet': missingVersion,
  'mode-or-priority-without-match': modeOrPriority,
  'incorrect-use-of-boolean-constants': booleanConstant,
  'text-outside-xsl-text': textOutsideXslText,
  'variable-or-param-with-select-and-content': selectAndContent,
}

module.exports = {
  FIXERS,
}
