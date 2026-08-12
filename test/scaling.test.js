/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {STAGES} = require('../src/xslint')
const {validate: validateXsls} = require('../src/validators/xsl-validator')
const {validate: validateXpaths} = require('../src/validators/xpath-validator')

/**
 * Stylesheets in the small corpus, and how many times more the large one holds.
 * A wider step separates the two shapes further apart than a cheaper one does —
 * a stage that grows with its input reads 4 where one that grows with the
 * square of it reads 16 — and the room between them is what a noisy machine is
 * paid for out of.
 * @type {number}
 */
const SMALL = 40

/**
 * How many times larger the second corpus is than the first.
 * @type {number}
 */
const STEP = 4

/**
 * The ratio a stage that grows with its input may not exceed. `STEP` is what it
 * should read; the room above that is what a shared machine spends, measured
 * here as 4.42 over ten trials against an ideal of 4.
 * @type {number}
 */
const LINEAR = 5.5

/**
 * Stages that grow faster than their input, each with the ceiling it may not
 * cross and the ticket that will retire the entry. A ratchet, not a licence:
 * the entry holds the defect where it stands so a second one cannot hide behind
 * it, and the ticket is what removes it. `corpus-linter` is the one entry:
 * it matches every declaration against every usage, and #755 made that 2.6
 * times cheaper without retiring the product. `import-linter` walks the whole
 * graph once per edge and so costs the square of a chain of imports (#769), yet
 * is not here — at this corpus the per-edge cost still dominates and it reads
 * 4.0, which is what a gate of one size cannot see and the scheduled run over
 * real projects is for.
 * @type {{[stage: string]: {ceiling: number, issue: number}}}
 */
const SUPERLINEAR = {
  'corpus-linter': {ceiling: 8.0, issue: 755},
}

/**
 * How many times a disagreeing measurement is taken again before it is
 * believed. Noise moves a ratio in both directions — an interrupted small
 * measurement reads low, an interrupted large one reads high — and it moves a
 * different one each time, where a stage that has really changed shape reads
 * the same way in every attempt.
 * @type {number}
 */
const ATTEMPTS = 3

/**
 * Distance between the file numbers of one attempt and the next. Expressions
 * are parsed once per distinct text and remembered against it, so a corpus that
 * repeated another's names would be answered out of that memo and read as
 * though the work had shrunk.
 * @type {number}
 */
const SPREAD = 100000

/**
 * Stylesheets in the corpus a first, discarded measurement is taken over.
 * Without it the first stage of the first attempt is timed cold and reads half
 * what it costs warm, which puts every ratio of that attempt below what it
 * should be — a bias, not noise, and one no retry corrects because it is the
 * measurement that is wrong rather than the machine.
 * @type {number}
 */
const WARMUP = 10

/**
 * One template, holding an expression of every shape the pipeline reads: an
 * axis, a comparison with zero, a call each linter is about, an attribute value
 * template, a predicate, and a literal result element in a namespace. A stage
 * given nothing it is about cannot be measured at all, which is what the three
 * per-document linters were until this corpus grew namespaces and imports.
 * @param {number} seed - Number of the stylesheet
 * @param {number} at - Number of the template within it
 * @param {number} templates - How many templates the stylesheet holds
 * @return {string} - The XML of one `xsl:template`
 */
const template = function(seed, at, templates) {
  const own = `${seed}x${at}`
  return [
    `  <xsl:template name="t${own}" match="node${own}">`,
    `    <xsl:variable name="v${own}" select="child::a${own}/b${own}"/>`,
    `    <xsl:if test="count($v${own}/c${own}) = 0">`,
    `      <svg:g id="g${own}" n="{ name($v${own}) }">`,
    `        <html:p class="p${own}">`,
    `          <xsl:value-of select="translate($v${own}, 'a${own}', 'b${own}')"/>`,
    `        </html:p>`,
    `        <math:mi>`,
    `          <xsl:value-of select="not(not($v${own}/d${own}))"/>`,
    `        </math:mi>`,
    `        <xsl:value-of select="boolean($v${own}/e${own})"/>`,
    `        <xsl:value-of select="string-length($v${own}/f${own}) &gt; 0"/>`,
    `      </svg:g>`,
    `    </xsl:if>`,
    `    <xsl:for-each select="descendant::g${own}[1]/namespace::*">`,
    `      <xsl:call-template name="t${seed}x${(at + 1) % templates}"/>`,
    `    </xsl:for-each>`,
    `  </xsl:template>`,
  ].join('\n')
}

/**
 * One stylesheet, every name in it carrying the number of the file so no two
 * share an expression, a declaration or a namespace. Sharing them would make
 * the corpus cheaper the larger it grew, which is the one direction a gate
 * against growth must not be generous in.
 * @param {number} seed - Number of the stylesheet
 * @param {number} templates - How many templates it holds
 * @return {string} - The XML of one stylesheet
 */
const sheet = function(seed, templates) {
  const body = []
  for (let at = 0; at < templates; at++) {
    body.push(template(seed, at, templates))
  }
  return [
    '<?xml version="1.0"?>',
    '<xsl:stylesheet version="2.0"',
    '  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"',
    '  xmlns:svg="http://www.w3.org/2000/svg"',
    '  xmlns:html="http://www.w3.org/1999/xhtml"',
    '  xmlns:math="http://www.w3.org/1998/Math/MathML"',
    `  xmlns:mine="urn:mine:${seed}"`,
    `  xmlns:dead="urn:dead:${seed}"`,
    `  xmlns:gone="urn:gone:${seed}"`,
    '  exclude-result-prefixes="mine">',
    `  <xsl:import href="s${seed - 1}.xsl"/>`,
    '  <xsl:template match="/">',
    `    <xsl:call-template name="t${seed}x0"/>`,
    '  </xsl:template>',
    body.join('\n'),
    '</xsl:stylesheet>',
  ].join('\n')
}

/**
 * A corpus of stylesheets numbered from one file on, each importing the one
 * before it.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many to build
 * @return {Array.<{file: string, content: string}>} - Sources to lint
 */
const corpus = function(from, files) {
  const sources = []
  for (let at = 0; at < files; at++) {
    sources.push({file: `s${from + at}.xsl`, content: sheet(from + at, 4)})
  }
  return sources
}

/**
 * How long a call takes, in milliseconds, beside whatever it answers.
 * @param {function(): object} fun - What to time
 * @return {{span: number, answer: object}} - Milliseconds and the answer
 */
const timed = function(fun) {
  const began = process.hrtime.bigint()
  const answer = fun()
  return {span: Number(process.hrtime.bigint() - began) / 1e6, answer: answer}
}

/**
 * Milliseconds each stage spends over one corpus, timed directly rather than by
 * subtracting one run from another: the error of two timings compounds, and a
 * stage whose own ratio is stable to three percent reads twenty that way.
 * @param {number} from - Number of the first stylesheet
 * @param {number} files - How many the corpus holds
 * @return {Map.<string, number>} - Milliseconds by stage
 */
const measured = function(from, files) {
  const sources = corpus(from, files)
  const spans = new Map()
  const xsls = timed(() => validateXsls(sources, []))
  spans.set('xsl-validator', xsls.span)
  const xpaths = timed(() => validateXpaths(xsls.answer.corpus, []))
  spans.set('xpath-validator', xpaths.span)
  for (const stage of STAGES) {
    let given = xpaths.answer.expressions
    if (stage.over === 'corpus') {
      given = xsls.answer.corpus
    }
    spans.set(stage.name, timed(() => stage.run(given, [])).span)
  }
  return spans
}

/**
 * How much each stage grows when the corpus grows `STEP` times. The quotient of
 * two measurements taken in one process is what survives a shared machine: a
 * slow runner slows both halves and cancels out of it, where an absolute
 * threshold either flakes or is set loose enough to catch nothing.
 * @param {number} attempt - Which attempt this is, deciding the file numbers
 * @return {Map.<string, number>} - Ratio by stage
 */
const grown = function(attempt) {
  const small = measured(attempt * SPREAD, SMALL)
  const large = measured(attempt * SPREAD + SPREAD / 2, SMALL * STEP)
  return new Map(
    Array.from(small, ([name, span]) => [name, large.get(name) / span]),
  )
}

/**
 * What is wrong with a stage's readings, or an empty string when nothing is.
 * The lowest reading answers whether a stage grew too fast and the highest
 * whether it stopped, since noise only ever makes one attempt disagree with
 * the rest and both questions are asked against the attempt that speaks for
 * the stage rather than for the machine.
 * @param {string} name - Name of the stage
 * @param {Array.<number>} readings - Its ratio in each attempt so far
 * @return {string} - The fault, or an empty string
 */
const fault = function(name, readings) {
  const low = Math.min(...readings)
  const high = Math.max(...readings)
  const known = SUPERLINEAR[name]
  let said = ''
  if (!known && low > LINEAR) {
    said = `${name} grew ${low.toFixed(1)}x while its corpus grew ${STEP}x, ` +
      `where ${LINEAR}x is the most a stage that grows with its input reads`
  } else if (known && low > known.ceiling) {
    said = `${name} grew ${low.toFixed(1)}x, past the ${known.ceiling}x that ` +
      `#${known.issue} holds it at, so it is worse than the ticket says`
  } else if (known && high <= LINEAR) {
    said = `${name} grew only ${high.toFixed(1)}x, so #${known.issue} looks ` +
      `settled and the entry exempting it is stale`
  }
  return said
}

/**
 * Every stage whose growth disagrees with what its bar says, measured again up
 * to `ATTEMPTS` times while any of them does. A machine under load moves a
 * different stage each time, so a second attempt agrees; a stage that has
 * changed shape disagrees in all three.
 * @return {Array.<string>} - One sentence per stage at fault
 */
const faults = function() {
  measured(ATTEMPTS * SPREAD, WARMUP)
  const readings = new Map()
  let found = []
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    for (const [name, ratio] of grown(attempt)) {
      readings.set(name, (readings.get(name) ?? []).concat([ratio]))
    }
    found = Array.from(readings, ([name, list]) => fault(name, list))
      .filter((said) => said !== '')
    if (found.length === 0) {
      break
    }
  }
  return found
}

describe('scaling', function() {
  it('holds every stage to the growth its bar allows', function() {
    this.timeout(120000)
    assert.deepEqual(
      faults(),
      [],
      'a stage no longer grows the way the bar in test/scaling.test.js says',
    )
  })
  it('measures every linter the pipeline is staged from', function() {
    assert.deepEqual(
      fs.readdirSync(path.join(__dirname, '..', 'src', 'linters'))
        .filter((file) => file.endsWith('-linter.js'))
        .map((file) => path.basename(file, '.js'))
        .filter((name) => !STAGES.some((stage) => stage.name === name)),
      [],
      'a linter reaches no stage of the pipeline, so nothing measures it',
    )
  })
})
