/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

const fs = require('fs')
const path = require('path')
const {kinds} = require('../src/resources/checks.json')

/**
 * The repository, one directory above this file.
 * @type {string}
 */
const ROOT = path.resolve(__dirname, '..')

/**
 * The document whose figures this file answers for.
 * @type {string}
 */
const README = path.join(ROOT, 'README.md')

/**
 * Where the reports every nightly corpus run is diffed against stand, which
 * is what makes a figure taken off them a figure the tree still draws.
 * @type {string}
 */
const CORPORA = path.join(ROOT, 'test', 'resources', 'corpora')

/**
 * Every defect the three committed reports hold, as the corpus that drew it,
 * the file it stands in and the check that found it. The corpus is carried
 * beside the file because a report names a file relative to its own corpus
 * root, so nothing shorter than the pair is unique across the three — none
 * collide today, and a count reading two of them as one would be short.
 * @return {Array.<{file: string, check: string}>} - One entry per defect
 */
const drawn = function() {
  return fs.readdirSync(CORPORA)
    .filter((name) => name.endsWith('.txt'))
    .flatMap((name) => fs.readFileSync(path.join(CORPORA, name), 'utf-8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => ({
        file: `${name}/${line.split(':')[0]}`,
        check: line.split(' ')[1],
      })))
}

/**
 * What the reports hold, read once.
 * @type {Array.<{file: string, check: string}>}
 */
const DRAWN = drawn()

/**
 * A pattern whose every gap reads as the line break a wrapped document may
 * have put there instead of a space, so reflowing a paragraph moves no figure
 * out of reach — while rewording the prose around one still does.
 * @param {RegExp} pattern - The pattern as it is written
 * @return {RegExp} - The same pattern, over a document that wraps
 */
const wrapped = function(pattern) {
  return new RegExp(pattern.source.replaceAll(' ', '[ \n]'))
}

/**
 * Each check the Proven section names, beside the prose that names it. The
 * prose is the anchor and the digits are the capture, so rewording the
 * sentence around a figure reddens rather than quietly freeing it.
 * @type {{[check: string]: RegExp}}
 */
const NAMED = {
  'text-outside-xsl-text': /([0-9,]+) pieces of literal text outside/,
  'use-choose-without-otherwise': /([0-9,]+) `xsl:choose` blocks/,
  'unused-function-template-parameter':
    /([0-9,]+) template and function parameters/,
}

/**
 * Every figure the README states that the tree can answer, each beside the
 * pattern finding it and the number the tree reads. A figure nothing here
 * names is prose, and a figure named twice is a sentence this file cannot
 * keep — which is why `test/readme.test.js` asks each pattern how often it
 * matches.
 * @type {Array.<{what: string, pattern: RegExp, reads: number}>}
 */
const FIGURES = [
  {
    what: 'findings',
    pattern: wrapped(/\*\*([0-9,]+) findings/),
    reads: DRAWN.length,
  },
  {
    what: 'checks that drew one',
    pattern: wrapped(/across ([0-9,]+) different checks/),
    reads: new Set(DRAWN.map((one) => one.check)).size,
  },
  {
    what: 'stylesheets that drew one',
    pattern: wrapped(/in ([0-9,]+) stylesheets/),
    reads: new Set(DRAWN.map((one) => one.file)).size,
  },
].concat(
  Object.entries(NAMED).map((named) => ({
    what: named[0],
    pattern: wrapped(named[1]),
    reads: DRAWN.filter((one) => one.check === named[0]).length,
  })),
  [{
    what: 'checks written in code',
    pattern: wrapped(/The kind holds ([0-9,]+) checks/),
    reads: Object.keys(kinds.format).length,
  }],
)

/**
 * A number as this document writes one, grouped in threes rather than by the
 * runtime's locale, a figure the tree states being nobody's to localise.
 * @param {number} amount - The number
 * @return {string} - How the README spells it
 */
const spelled = function(amount) {
  return `${amount}`.replace(/\B(?=([0-9]{3})+$)/g, ',')
}

/**
 * Every figure the README does not state as the tree reads it: one whose
 * prose is gone, and one whose number has moved.
 * @param {string} readme - The document as it stands
 * @return {Array.<{figure: object, stated: string}>} - The disagreements
 */
const wrong = function(readme) {
  return FIGURES.map((figure) => ({
    figure: figure,
    stated: (readme.match(figure.pattern) ?? [])[1],
  })).filter((one) => one.stated !== spelled(one.figure.reads))
}

/**
 * How one disagreement reads, a figure whose prose has gone being a different
 * fault from a figure whose number has: the first is a sentence to rewrite by
 * hand and the second is what `npx grunt readme` writes.
 * @param {{figure: object, stated: string}} one - The disagreement
 * @return {string} - What to say of it
 */
const said = function(one) {
  let sentence = [
    `${one.figure.what} reads ${spelled(one.figure.reads)}`,
    `where the README says ${one.stated}`,
  ].join(' ')
  if (one.stated === undefined) {
    sentence = [
      `${one.figure.what} reads ${spelled(one.figure.reads)} and`,
      'the README no longer holds the sentence stating it',
    ].join(' ')
  }
  return sentence
}

/**
 * What is wrong with the figures a document states, or an empty string when
 * nothing is.
 * @param {string} readme - The document as it stands
 * @return {string} - The fault, or an empty string
 */
const verdict = function(readme) {
  let sentence = ''
  if (wrong(readme).length > 0) {
    sentence = [
      'the README states a figure the tree does not read, so run',
      `npx grunt readme and commit it: ${wrong(readme).map(said).join('; ')}`,
    ].join(' ')
  }
  return sentence
}

/**
 * A document with every figure the tree can answer written as the tree reads
 * it. A figure whose prose is gone is left alone, there being nowhere to
 * write it, and the verdict is what names that one.
 * @param {string} readme - The document as it stands
 * @return {string} - The document as the tree reads it
 */
const rendered = function(readme) {
  let written = readme
  for (const figure of FIGURES) {
    written = written.replace(
      figure.pattern,
      (whole, stated) => whole.replace(stated, spelled(figure.reads)),
    )
  }
  return written
}

/**
 * Write the figures the tree reads into a document, which is the whole of how
 * a meant change is accepted.
 * @param {string} file - The document to rewrite
 * @return {string} - What the task reports of it
 */
const generate = function(file) {
  const before = fs.readFileSync(file, 'utf-8')
  fs.writeFileSync(file, rendered(before))
  return [
    `${path.basename(file)}: ${FIGURES.length} figures read off the`,
    `tree, ${wrong(before).length} of them restated`,
  ].join(' ')
}

module.exports = {FIGURES, NAMED, README, generate, rendered, spelled, verdict}
