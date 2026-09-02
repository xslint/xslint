/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Two tables, and the second is the load-bearing one. `COMPILED` names
 * every spelling the vocabulary answers off the walk, so a construct that
 * stops being served turns red rather than quietly costing a fontoxpath
 * call per candidate again. `REFUSED` names every spelling it does not,
 * each beside what puts it out of reach, and is a ratchet from the other
 * side: an entry that *becomes* reachable fails, so the list cannot sit
 * there reading like a limit still in force after the limit has gone. It
 * caught its author — widening the vocabulary to sibling and ancestor axes,
 * a path in a value position and two string functions turned five `REFUSED`
 * rows red in one run, which is the whole reason they are rows and not a
 * sentence. It caught him twice: the descendant axis took its own row off
 * the table at #811's last phase, and two of the three replacing it are
 * shapes `pathed` had been answering all along — an absolute path, and a
 * descent standing mid-path — since it weighed no separator at all.
 *
 * A third gate stands beside them and its subject is the module's own
 * header note. Relocating a derivation into one — which is what the bar
 * below forced here — takes it out of the reach of the gate holding a
 * guide's counts to the code, `DOCUMENTS` naming guides and the README and
 * no source file but `src/attributes.js`. So the two counts that note
 * states of the vocabulary's reach, 30 of 38, are computed here from
 * `checks.json` and held to it: every branch a selector splits into that
 * the walk serves, parted by the `predicated` a run parts with, each
 * predicate asked once. Both kinds are read, a corpus check's declaration
 * and usage reaching `predicateOf` as a per-file selector does — the
 * `xpath` kind alone answers 28 of 35, which is no number a run ever sees,
 * and counting it that way is how the note came to say 33 and 24. Two
 * sentences carry the pair in opposite orders, so both are read and
 * rewording either fails, the lesson `DERIVED` records one section down.
 *
 * Neither table asks whether an answer is *correct*: that is `CANDIDATES`
 * in `test/selectors.test.js`, which asks fontoxpath what each spelling
 * selects over `candidates.xsl` and fails where serving answers anything
 * else — the oracle, 115 rows here against 32 before, and armed against the
 * engine before a line of the compiler existed. A row there is a question
 * rather than a claim, so enriching the fixture can only strengthen it; the
 * fixture grew five variables and a non-XSLT child so that presence, a
 * literal sequence, a string length, a parent and `count(*)` each split the
 * nine candidates unevenly, and a group three deep at #811's descendant
 * phase, so that `xsl:variable//xsl:text` answers something
 * `xsl:variable/xsl:text` does not — on the shallower fixture the two read
 * alike, and the row asking about the descent would have passed while
 * `pathed` weighed no separator at all. That width is held to the sweep
 * from here on, having drifted twice inside a paragraph that reads like a
 * question asked per spelling. One thing it cannot hold is a prefix
 * `src/xpath.js` does not bind: `my:thing` stands in the document for
 * `count(*)` to see and is named in no selector, the engine raising
 * `XPST0081` on an unbound prefix rather than answering.
 *
 * What a question cannot reach is what nobody hands it, and that is how
 * three defects walked past 87 rows of it. Two things a table of
 * *predicates* cannot supply: the **characters** the fixture is written in,
 * every name in it having stood inside the Basic Multilingual Plane where
 * `.length` is XPath's `string-length` by coincidence, so a shipped check
 * went silent on a name of one astral character and the row asking a length
 * of one passed — a test asserts the fixture still holds such a name, an
 * arming being no assertion until something fails without it; and the
 * **kind** of node a predicate is handed, `AXIS` being one element step, so
 * no row could reach an attribute's missing parent or a root element's
 * document standing in for one. `HEADED` is the answer to that second one:
 * ten rows carrying a head of their own, `//@*` read off the check that
 * spells it, and `answered` compares a **place** and no longer a name, an
 * attribute having no `getAttribute` to answer with at all.
 */

const assert = require('assert')
const {describe, it} = require('mocha')
const {predicateOf} = require('../src/predicates')
const {predicated, splitOf} = require('../src/selectors')
const {worded} = require('./guides')
const {kinds} = require('../src/resources/checks.json')
const {GAP} = require('../src/tokens')

/**
 * The file whose header note states what the vocabulary reaches, and the
 * reason this gate stands here rather than beside the guides': a derivation
 * relocated into a file-header note leaves the reach of the gate holding a
 * guide's counts to the code, so a count that moved out of `src/CLAUDE.md`
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
        for (const one of predicated(branch.tail)) {
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
 * whichever copy nobody touched — the lesson `DERIVED` records one directory
 * over — so every carrier is named and every occurrence in it is read.
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
    where: NOTE,
    claim: /(\d+) of the (\d+) compile either way/g,
    truth: (found) => [String(found.whole.compiled), String(found.whole.every)],
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
  'normalize-space(@test) = ("\'true\'", \'"false"\')',
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
    text: 'not(text()[normalize-space()])',
    why: 'a kind test, which xml:space decides the meaning of',
  },
  {
    text: 'normalize-space() = ""',
    why: 'a call taking the context node, which no step names',
  },
  {
    text: 'count(node()) = count(text())',
    why: 'a comparison whose far side is computed per candidate',
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
    text: 'normalize-space(xsl:text) = "alpha"',
    why: 'that same element, one call further in',
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
        'a document states a reach the checks do not: ' +
          `${found.whole.compiled} of ${found.whole.every} distinct ` +
          'predicates compile here, and no guide gate reads a file-header ' +
          'note, so a count relocated into one answers to this alone',
      )
    })
  COMPILED.forEach((one) => {
    it(`answers [${one}] without the engine`, function() {
      assert.notStrictEqual(
        predicateOf(one),
        undefined,
        `the vocabulary does not reach [${one}], so every candidate of every ` +
          'selector spelling it still costs one fontoxpath call for a ' +
          'question the walk holds the answer to',
      )
    })
  })
  REFUSED.forEach((one) => {
    it(`refuses [${one.text}], holding ${one.why}`, function() {
      assert.strictEqual(
        predicateOf(one.text),
        undefined,
        `[${one.text}] is compiled although it holds ${one.why}, and an ` +
          'answer this vocabulary cannot give correctly is worse than the ' +
          'engine call it saves',
      )
    })
  })
})
