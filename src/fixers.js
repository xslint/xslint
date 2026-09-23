/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {deletion, escaped, substitution} = require('./fixes')
const {XSLT} = require('./xsl-version')

/**
 * Text a deletion emits unchanged: no character a serializer escapes — both
 * xsltproc and Saxon write `&`, `<` and `>` as references where the attribute
 * is gone, under the xml method and the html one alike — and no brace, which
 * in a 3.0 stylesheet stands for a value the run supplies (#990).
 * @type {RegExp}
 */
const PLAIN = /^[^&<>{]*$/

/**
 * Fix for `using-disable-output-escaping`: delete the attribute where the
 * deletion emits what the stylesheet emitted with it. That is an `xsl:text`
 * spelling its own output, and never an `xsl:value-of`, whose value the run
 * supplies and whose escaping therefore always matters (#990).
 * @param {Element} node - The element carrying the attribute
 * @param {string} content - Raw source text of the file it stands in
 * @return {?object} - The fix, or nothing where the output would change
 */
const disableOutputEscaping = function(node, content) {
  let fix = undefined
  if (node.localName === 'text' && PLAIN.test(node.textContent)) {
    fix = deletion(node.getAttributeNode('disable-output-escaping'), content)
  }
  return fix
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
 * way `missingVersion` reads one (#976). Only when the instruction holds
 * exactly one non-whitespace text node can a single edit resolve the defect —
 * with text on both sides of a child element there are several to wrap.
 * @param {Element} node - The instruction element holding the loose text
 * @return {?object} - The fix, or null
 */
const textOutsideXslText = function(node) {
  const texts = Array.from(node.childNodes).filter(
    (child) => child.nodeType === 3 && child.nodeValue.trim() !== '',
  )
  const prefix = node.lookupPrefix(XSLT)
  let fix = null
  if (texts.length === 1 && prefix) {
    fix = {
      line: texts[0].lineNumber,
      col: texts[0].columnNumber,
      value: texts[0].nodeValue,
      replacement:
        `<${prefix}:text>${escaped(texts[0].nodeValue)}` +
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
