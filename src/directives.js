/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {GAP, WHITESPACE} = require('./tokens')

/**
 * Directive keywords and the scope each one covers: the whole file, the line
 * after the comment, or the comment's own line.
 * @type {{FILE: string, NEXT_LINE: string, LINE: string}}
 */
const TYPES = {
  FILE: 'disable-file',
  NEXT_LINE: 'disable-next-line',
  LINE: 'disable-line',
}

/**
 * Inline suppression directives, written as XML comments. Rule names are
 * optional and space-separated; with none, the directive covers every rule at
 * its location. NEXT_LINE precedes LINE in the alternation so the longer
 * keyword wins.
 * @type {RegExp}
 */
const DIRECTIVE = new RegExp(
  `<!--${GAP}*xslint-(` +
  [TYPES.FILE, TYPES.NEXT_LINE, TYPES.LINE].join('|') +
  `)([a-z0-9${WHITESPACE}-]*)-->`,
  'g',
)

/**
 * Inline directives found in a stylesheet's raw text, each with the line it
 * sits on and the rule names it names.
 * @param {string} content - Raw stylesheet text
 * @return {Array.<{type: string, line: number, names: Array.<string>}>} -
 *  Directives in the order they appear
 */
const directivesFrom = function(content) {
  const directives = []
  for (const match of content.matchAll(DIRECTIVE)) {
    directives.push({
      type: match[1],
      line: content.slice(0, match.index).split('\n').length,
      names: match[2].trim().split(new RegExp(`${GAP}+`)).filter((name) => name.length > 0),
    })
  }
  return directives
}

/**
 * Whether a single directive covers given defect. A directive with no names
 * covers every rule; otherwise only the ones it names. A defect standing in an
 * value that wraps is reported on the line it truly occupies, which no comment
 * can sit above — a start tag admits none, and the tag itself may wrap before
 * the value does — so the directive reaches anywhere from the line the holding
 * element opens on, `from`, down to the defect itself.
 * @param {{type: string, line: number, names: Array.<string>}} directive -
 *  Directive to test
 * @param {{name: string, line: number, from: number}} defect - Defect to test
 * @return {boolean} - True when the directive covers the defect
 */
const covers = function(directive, defect) {
  const named = directive.names.length === 0 ||
    directive.names.includes(defect.name)
  const covered = directive.type === TYPES.NEXT_LINE ?
    directive.line + 1 :
    directive.line
  return named && (directive.type === TYPES.FILE ||
    (covered >= (defect.from || defect.line) && covered <= defect.line))
}

/**
 * Whether any directive suppresses given defect.
 * @param {Array.<{type: string, line: number, names: Array.<string>}>}
 *  directives - Directives from the defect's file
 * @param {{name: string, line: number}} defect - Defect to test
 * @return {boolean} - True when a directive suppresses the defect
 */
const suppresses = function(directives, defect) {
  return directives.some((directive) => covers(directive, defect))
}

/**
 * Directives that suppressed none of given defects, so they sit over code that
 * no longer triggers what they silence.
 * @param {Array.<{type: string, line: number, names: Array.<string>}>}
 *  directives - Directives from a file
 * @param {Array.<{name: string, line: number}>} defects - Defects of that file
 * @return {Array.<{type: string, line: number, names: Array.<string>}>} -
 *  The directives that covered nothing
 */
const unused = function(directives, defects) {
  return directives.filter(
    (directive) => !defects.some((defect) => covers(directive, defect)),
  )
}

module.exports = {
  directivesFrom,
  suppresses,
  unused,
}
