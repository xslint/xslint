/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Two tables, and the second is the load-bearing one. `COMPILED` names every
 * spelling the vocabulary answers off the walk, `REFUSED` every one it does
 * not beside what puts it out of reach, and an entry crossing over fails
 * (#811). A third gate holds what the note atop `src/predicates.js` states of
 * the vocabulary's reach, 44 of 56, to `checks.json`; the `xpath` kind alone
 * answers 42 of 53, which no run sees. Whether an answer is correct is
 * `CANDIDATES` in `test/selectors.test.js` with `HEADED` beside it, the
 * oracle, 167 rows here, a row with a head of its own being how a predicate
 * is handed an attribute when `AXIS` is one element step.
 */

const assert = require('assert')
const {describe, it} = require('mocha')
const {predicateOf} = require('../src/predicates')
const {splitOf, weighed} = require('../src/selectors')
const {worded} = require('./guides')
const {kinds} = require('../src/resources/checks.json')
const {GAP} = require('../src/tokens')

/**
 * The file whose header note states what the vocabulary reaches, and the
 * reason this gate stands here rather than beside the guides': a derivation
 * relocated into a file-header note leaves the reach of the gate holding a
 * guide's counts to the code, so a count that moved out of a guide
 * would answer to nothing at all (#821, #811).
 * @type {string}
 */
const NOTE = 'src/predicates.js'

/**
 * What the vocabulary reaches over the checks it is handed, counted the way a
 * run counts it: every branch a selector splits into that the walk serves,
 * parted by the parting `narrowed` uses, each predicate asked once. A corpus
 * check's declaration and usage reach `predicateOf` as a per-file selector
 * does, and reading the `xpath` kind alone is how the note said 24 of 33.
 * @param {Array.<object>} checks - The checks to read, each a selector holder
 * @return {{every: number, compiled: number}} - How many distinct predicates
 *  they hold between them, and how many of those compile
 */
const reach = function(checks) {
  const seen = new Map()
  const read = function(xpath) {
    for (const branch of splitOf(xpath)) {
      if (branch.refused === '' && branch.tail !== '') {
        for (const one of weighed(branch.tail)) {
          seen.set(one, predicateOf(one) !== undefined)
        }
      }
    }
  }
  checks.forEach((check) => {
    [check.xpath, check.declaration, check.usage]
      .filter((one) => one !== undefined).forEach(read)
  })
  return {
    every: seen.size,
    compiled: [...seen.values()].filter((one) => one).length,
  }
}

/**
 * The checks a run loads, both declarative kinds together and the per-file
 * kind on its own — the pair the note contrasts.
 * @type {{whole: Array.<object>, narrow: Array.<object>}}
 */
const READS = {
  whole: Object.values(kinds.xpath).concat(Object.values(kinds.corpus)),
  narrow: Object.values(kinds.xpath),
}

/**
 * Each way this reach is stated, wherever it is stated, paired with what the
 * tree answers. A claim carried twice and asked as an `any` is satisfied by
 * whichever copy nobody touched — the lesson `test/guides.test.js`
 * records — so every carrier is named and every occurrence in it is read.
 * @type {Array.<{where: string, claim: RegExp,
 *  truth: function(object): Array.<string>}>}
 */
const STATED = [
  {
    where: NOTE,
    claim: /the (\d+) distinct predicates in the tree is compiled once a run; (\d+)/g,
    truth: (found) => [String(found.whole.every), String(found.whole.compiled)],
  },
  {
    where: 'test/predicates.test.js',
    claim: new RegExp(
      `states of the vocabulary's reach, (\\d+) of${GAP}+(\\d+),`, 'g',
    ),
    truth: (found) => [String(found.whole.compiled), String(found.whole.every)],
  },
  {
    where: 'test/predicates.test.js',
    claim: /`xpath` kind alone answers (\d+) of (\d+)/g,
    truth: (found) => [
      String(found.narrow.compiled), String(found.narrow.every),
    ],
  },
]

/**
 * Predicate spellings the vocabulary reaches, each of which a check in
 * `checks/xpath/` writes or is one construct away from writing. A row here is
 * a claim that the walk answers it without the engine; whether it answers it
 * correctly is `test/selectors.test.js`'s question, which asks fontoxpath
 * what the same spelling selects.
 * @type {Array.<string>}
 */
const COMPILED = [
  '@name',
  '@select',
  'not(@name)',
  'not(@select)',
  '@select and @as',
  '@select or @as',
  'not(@match) and (@mode or @priority)',
  'not(@name) and not(@match)',
  '@disable-output-escaping = "yes"',
  '@name = ("one", "three")',
  'xslint:normalize-space(@test) = ("\'true\'", \'"false"\')',
  'string-length(@name) = 1',
  'count(xsl:when) = 1',
  'count(xsl:when) >= 2',
  'not(xsl:otherwise) and count(xsl:when) >= 2',
  'count(xsl:when) = 1 and not(xsl:otherwise)',
  'count(*) = 1',
  'not(*)',
  'not(xsl:when)',
  'self::xsl:variable',
  'parent::xsl:choose',
  'not(parent::xsl:choose)',
  'parent::*[not(self::xsl:template)]',
  '(@select)',
  'xsl:value-of[not(@separator)]',
  '@name = preceding-sibling::xsl:param/@name',
  'following-sibling::*',
  'not(ancestor::xsl:override)',
  'not(contains(@name, \'{\'))',
  'string-length(substring-after(@name, ":")) = 1',
  'string-length(substring-after(@name, ":")) = 1 or (string-length(@name) = 1 and not(contains(@name, ":")))',
  'preceding-sibling::*[not(self::xsl:sort) and not(self::xsl:with-param)]',
  'parent::*[not(self::xsl:*)]',
  'not(*) or (count(*) = 1 and xsl:value-of[not(@separator)])',
  'count(*) != 1',
  'count(*) < 2',
  'count(*) <= 1',
  '@name/@x',
  'substring-after(@name, "o") = "ne"',
  'string-length(substring-after(@nope, @also)) = 0',
  'not(contains(@name, @nope))',
  'xsl:text',
  'parent::*',
  'count(.//xsl:*) > 100',
  'count(descendant::xsl:*) >= 2',
  './/xsl:text',
  'text()',
  'not(text())',
  'text()[xslint:normalize-space(.)]',
  'not(text()[xslint:normalize-space(.)])',
  'count(text()) = 1',
  'local-name() = "template"',
  'not(local-name() = (\'text\', \'param\'))',
  'xslint:attribute(., \'disable-output-escaping\') = \'yes\'',
  'xslint:attribute(., \'name\') = preceding-sibling::xsl:with-param/xslint:attribute(., \'name\')',
  'string-length(xslint:attribute(., \'name\')) = 1',
]

/**
 * Spellings the vocabulary refuses, each beside what puts it out of reach, so
 * an entry that becomes reachable turns red rather than sitting here reading
 * like a limit still in force. Refusing is never wrong, only dearer: the
 * engine answers what this cannot, and over-acceptance is the one failure a
 * split may not commit.
 * @type {Array.<{text: string, why: string}>}
 */
const REFUSED = [
  {
    text: 'matches(@name, \'^[0-9]\')',
    why: 'a regex, whose XPath flavour is not JavaScript\'s',
  },
  {
    text: 'following::*',
    why: 'a document-order axis, whose candidates nobody has counted',
  },
  {
    text: 'substring-before(@name, ":") = "xsl"',
    why: 'a string function outside the vocabulary',
  },
  {
    text: '@x > 1',
    why: 'a number compared against what an attribute holds as a string',
  },
  {
    text: '@name != "one"',
    why: 'a negated existential, the comparison easiest to answer wrongly',
  },
  {
    text: 'local-name(@name) = "name"',
    why: 'a call taking a node set, where this answers the candidate\'s own',
  },
  {
    text: 'normalize-space(@test) = ""',
    why: 'the engine\'s own, whose gap is wider than the one XPath defines',
  },
  {
    text: 'count(node()) = count(text())',
    why: 'a kind test wider than text(), admitting a comment and a gap',
  },
  {
    text: 'descendant::text()',
    why: 'that kind test off the child axis, where no descent gathers one',
  },
  {
    text: 'comment()',
    why: 'a kind of node no selector in the tree asks after',
  },
  {
    text: 'not(@as and (if (/xsl:stylesheet) then /*/@version else 1))',
    why: 'a conditional, and a path anchored at the root',
  },
  {
    text: 'position() = 1',
    why: 'a position, which no candidate can answer on its own',
  },
  {
    text: 'a',
    why: 'an unprefixed element name, which a default namespace may reach',
  },
  {
    text: 'xsl:text = "alpha"',
    why: 'an element in a value position, whose value is its whole subtree',
  },
  {
    text: 'xslint:normalize-space(xsl:text) = "alpha"',
    why: 'that same element, one call further in',
  },
  {
    text: 'xslint:normalize-space(.) = ""',
    why: 'the candidate itself in one, its value its own whole subtree',
  },
  {
    text: 'string-length(xslint:normalize-space(.)) = 5',
    why: 'that same subtree, reached by a second call over the first',
  },
  {
    text: 'xsl:variable/xsl:text = "alpha"',
    why: 'a path ending at an element rather than at an attribute',
  },
  {
    text: '//xsl:text',
    why: 'an absolute path, which asks the document and not the candidate',
  },
  {
    text: 'xsl:variable//xsl:text',
    why: 'a descent standing mid-path, where each step answers the one before',
  },
  {
    text: 'count(descendant-or-self::xsl:*) >= 2',
    why: 'an axis holding the candidate itself, which no check writes',
  },
  {
    text: '@name = xsl:text',
    why: 'that element on the far side of a comparison, a step and no path',
  },
  {
    text: 'xslint:version(.) < 2.0',
    why: [
      'the other function of ours, whose answer is an ancestor climb',
      'rather than anything a bucket keeps beside a candidate',
    ].join(' '),
  },
  {
    text: 'xslint:attribute(@name, \'x\') = \'y\'',
    why: 'the third handed an attribute, which carries no attribute of its own',
  },
  {
    text: 'xslint:attribute(., @name) = \'y\'',
    why: 'the third asked of a name no literal spells',
  },
  {
    text: 'xsl:param/attribute::name/xslint:attribute(., \'x\') = \'y\'',
    why: 'the third behind a step reaching an attribute rather than an element',
  },
]

describe('predicates', function() {
  it('states what the vocabulary reaches, where the note states it',
    function() {
      const found = {whole: reach(READS.whole), narrow: reach(READS.narrow)}
      assert.deepStrictEqual(
        STATED.flatMap((one) => {
          const wanted = one.truth(found).join(' and ')
          const said = [...worded(one.where).matchAll(one.claim)]
            .map((each) => each.slice(1).join(' and '))
          let wrong = said.filter((each) => each !== wanted)
          if (said.length === 0) {
            wrong = [`nothing in the note says ${wanted}`]
          }
          return wrong
        }),
        [],
        [
          'a document states a reach the checks do not:',
          `${found.whole.compiled} of ${found.whole.every} distinct`,
          'predicates compile here, and no guide gate reads a file-header',
          'note, so a count relocated into one answers to this alone',
        ].join(' '),
      )
    })
  COMPILED.forEach((one) => {
    it(`answers [${one}] without the engine`, function() {
      assert.notStrictEqual(
        predicateOf(one),
        undefined,
        [
          `the vocabulary does not reach [${one}], so every candidate of every`,
          'selector spelling it still costs one fontoxpath call for a',
          'question the walk holds the answer to',
        ].join(' '),
      )
    })
  })
  REFUSED.forEach((one) => {
    it(`refuses [${one.text}], holding ${one.why}`, function() {
      assert.strictEqual(
        predicateOf(one.text),
        undefined,
        [
          `[${one.text}] is compiled although it holds ${one.why}, and an`,
          'answer this vocabulary cannot give correctly is worse than the',
          'engine call it saves',
        ].join(' '),
      )
    })
  })
})
