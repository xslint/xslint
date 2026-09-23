/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {deletion, escaped, substitution} = require('./fixes')
const {XSLT} = require('./xsl-version')

/**
 * The node kinds character data is written in: a text node, and the CDATA
 * section that is a text node spelled another way. A census of what an element
 * holds counts both, and an edit wraps only the first — `nodeValue` for a
 * CDATA section omits its delimiters, so a substitution written by value would
 * land inside them (#993).
 * @type {{[kind: string]: number}}
 */
const CHARACTERS = {text: 3, cdata: 4}

/**
 * Fix for `using-disable-output-escaping`: delete the attribute. Removing it
 * changes how the output is escaped, which is why the check declares it a
 * suggestion.
 * @param {Element} node - The element carrying the attribute
 * @param {string} content - Raw source text of the file it stands in
 * @return {object} - The fix
 */
const disableOutputEscaping = function(node, content) {
  return deletion(node.getAttributeNode('disable-output-escaping'), content)
}

/**
 * Fix for `missing-version-in-stylesheet`: declare the version right after the
 * element name. Which attribute follows the root's *namespace* and not its
 * name — an XSLT element takes a plain `version`, a simplified stylesheet the
 * namespaced one — so forking by name would write a second version onto
 * `xsl:package` (#608). The prefix is read, never assumed.
 * @param {Element} node - The root element of the stylesheet
 * @return {?object} - The fix, or nothing when none can be spelled
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
    }
  }
  return fix
}

/**
 * Fix for `mode-or-priority-without-match`: delete the orphan attribute, in
 * whichever of its two spellings the author wrote. It is one of two
 * corrections the rule offers (the other is adding `match`), which is why the
 * check declares it a suggestion, and only where exactly one of them stands
 * can a single deletion resolve the defect.
 * @param {Element} node - The `xsl:template` element
 * @param {string} content - Raw source text of the file it stands in
 * @return {?object} - The fix, or null
 */
const modeOrPriority = function(node, content) {
  const present = ['mode', '_mode', 'priority', '_priority']
    .filter((name) => node.hasAttribute(name))
  let fix = null
  if (present.length === 1) {
    fix = deletion(node.getAttributeNode(present[0]), content)
  }
  return fix
}

/**
 * Fix for `incorrect-use-of-boolean-constants`: replace the string literal
 * test `'true'`/`'false'` with the boolean `true()`/`false()`. The check
 * declares it a suggestion, `'false'` being a non-empty string that is always
 * true, so the rewrite changes the test's truth value — which is the point.
 * @param {Element} node - The `xsl:if`/`xsl:when` element
 * @param {string} content - Raw source text of the file it stands in
 * @return {object} - The fix
 */
const booleanConstant = function(node, content) {
  const test = node.getAttributeNode('test')
  let constant = 'false()'
  if (test.value.includes('true')) {
    constant = 'true()'
  }
  return substitution(test, constant, content)
}

/**
 * Fix for `text-outside-xsl-text`: wrap the literal text in `xsl:text`, under
 * the prefix the document binds to XSLT and withheld where it binds none, the
 * way `missingVersion` reads one (#976). One edit resolves the defect only
 * where the instruction holds a single piece of character data and that piece
 * is a text node, a CDATA section beside one leaving a second to wrap (#993).
 * @param {Element} node - The instruction element holding the loose text
 * @return {?object} - The fix, or null
 */
const textOutsideXslText = function(node) {
  const held = Array.from(node.childNodes).filter(
    (child) => Object.values(CHARACTERS).includes(child.nodeType) &&
      child.nodeValue.trim() !== '',
  )
  const prefix = node.lookupPrefix(XSLT)
  let fix = null
  if (held.length === 1 && held[0].nodeType === CHARACTERS.text && prefix) {
    fix = {
      line: held[0].lineNumber,
      col: held[0].columnNumber,
      value: held[0].nodeValue,
      replacement:
        `<${prefix}:text>${escaped(held[0].nodeValue)}` +
        `</${prefix}:text>`,
    }
  }
  return fix
}

/**
 * Fix for `variable-or-param-with-select-and-content`: delete the `@select`,
 * in whichever of its two spellings the author wrote, leaving the body as the
 * only value. It is one of the two corrections the rule offers — dropping the
 * body is structural, so no single edit expresses it — and the body binds a
 * tree where the expression bound its own type.
 * @param {Element} node - The variable-binding element
 * @param {string} content - Raw source text of the file it stands in
 * @return {?object} - The fix, or null
 */
const selectAndContent = function(node, content) {
  const present = ['select', '_select'].filter((name) => node.hasAttribute(name))
  let fix = null
  if (present.length === 1) {
    fix = deletion(node.getAttributeNode(present[0]), content)
  }
  return fix
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
