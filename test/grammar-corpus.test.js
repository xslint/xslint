/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * The two gates #680 stands in front of the parser, asked of every
 * expression the repository carries — 644 of them, from the committed
 * stylesheets, from the ones the packs hold inline, and from the selectors
 * the declarative checks are themselves written in. **Round trip**: a
 * parse's tokens join back into the expression byte for byte, every node's
 * span slices to its own text, and every child nests inside its parent in
 * order — the last of those is what slicing cannot see, since shifting a
 * node and its children together still slices. **Acceptance diff**: the
 * verdict is diffed against the engine's, asked as `compiles` and asked
 * alone — a respelling retry sits on the engine's side of that comparison
 * and hides every expression fontoxpath refuses and the squeeze rescues.
 * Forty do, and they are #639's family exactly, a spaced axis or a
 * `namespace::`; asking `compiles(xpath) || compiles(squeezed(xpath))`,
 * which is what `isValid` was until #732, cancels every one and reports the
 * evidence for retiring the retry as absent from the tree, when what is
 * absent is a comparison that can see it. So the forty are *subtracted*
 * rather than cancelled: `insists` in `test/strictness.js` reads the class
 * off the token stream, `EXPLAINED` takes it out of the diff, and what is
 * left over is annotated one line each in `GAPS`, naming the side that
 * accepts and the gap it stands for, so a new one and a stale one both turn
 * red. Subtracting a class can hide a defect the way the retry did, in one
 * direction, and that direction is gated: the class may only ever excuse
 * the grammar accepting where the engine refuses, never the engine
 * accepting where the grammar refuses, which would be an invented defect
 * excused (#738). Eleven stood when #680 wrote that list and **none** does
 * now, which is the measure working rather than the measure going quiet:
 * nine were a parenthesized step (#711), one a node comparison (#724) and
 * the last a name no NCName can spell (#708). An empty list is an
 * assertion, not the absence of one — every expression the repository
 * carries takes the same verdict from both sides, so a disagreement of
 * either kind turns it red — and it does not claim the two agree
 * everywhere, the corpus reaching only what the corpus holds, which is why
 * the classes #708 closed that no fixture spells are pinned in
 * `test/grammar.test.js` instead. The corpus is gated as well, because a
 * sweep can pass by finding nothing: each of the three sources must still
 * yield what it did when the gates were written, and the class must still
 * have forty expressions to subtract. The selectors are one expression in
 * twelve and held ten of the original eleven gaps — the checks are written
 * in an idiom the stylesheets never use, which is why a corpus of
 * stylesheets alone (#708) agreed completely and proved little.
 */

const {parsed} = require('../src/grammar')
const {compiles} = require('../src/xpath')
const {insists} = require('./strictness')
const {expressionsOf} = require('../src/attributes')
const {allFilesFrom, xml, yaml} = require('../src/helpers')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The two directories every fixture in the repository stands in: the
 * stylesheets the tests lint, and the checks the linters are made of.
 * @type {Array.<string>}
 */
const FIXTURES = [
  path.resolve(__dirname, 'resources'),
  path.resolve(__dirname, '..', 'src', 'resources'),
]

/**
 * The YAML keys a declarative check writes its own selector under.
 * @type {Array.<string>}
 */
const SELECTORS = ['xpath', 'declaration', 'usage']

/**
 * Every expression a stylesheet carries, or none at all when the text is not
 * well-formed XML. `malformed/bad.xsl` is committed to be unreadable, and an
 * expression standing inside it is beyond the reach of every stage of this
 * program, so it is beyond the reach of the sweep too.
 * @param {string} text - A stylesheet's source
 * @return {Array.<string>} - The expressions it holds
 */
const carried = function(text) {
  let held
  try {
    held = expressionsOf(xml.parsedFromString(text))
      .map((one) => one.expression)
  } catch {
    held = []
  }
  return held
}

/**
 * Every expression the fixtures carry, kept apart by where it was read from.
 * The stylesheets are the obvious corpus and the least interesting one: on
 * their own they agree with the engine completely. What the checks are written
 * in is a corpus too, and a harder one, since a selector is XPath a person
 * wrote to be read by this very parser.
 * @return {{[source: string]: Array.<string>}} - The expressions, by source
 */
const gathered = function() {
  const found = {stylesheet: [], pack: [], selector: []}
  for (const dir of FIXTURES) {
    for (const file of allFilesFrom(dir)) {
      if (file.endsWith('.xsl')) {
        found.stylesheet = found.stylesheet.concat(
          carried(fs.readFileSync(file, 'utf8')),
        )
      }
      if (file.endsWith('.yaml')) {
        const pack = yaml.parsedFromFile(file)
        for (const input of pack.inputs || [pack.input]) {
          if (typeof input === 'string') {
            found.pack = found.pack.concat(carried(input))
          }
        }
        found.selector = found.selector.concat(
          SELECTORS
            .filter((key) => typeof pack[key] === 'string')
            .map((key) => pack[key]),
        )
      }
    }
  }
  return found
}

/**
 * The expressions by source, gathered once, since the sweep reads every
 * fixture in the repository and every test below asks about the same one.
 * @type {{[source: string]: Array.<string>}}
 */
const SWEPT = gathered()

/**
 * Every distinct expression the repository holds, whatever it was read from.
 * @type {Array.<string>}
 */
const CORPUS = Array.from(new Set(
  SWEPT.stylesheet.concat(SWEPT.pack, SWEPT.selector),
))

/**
 * How thin a source may run before this file is answering about a corpus of
 * its own imagining rather than about the repository. A gate over a sweep can
 * pass by finding nothing, so the sweep is gated too. A floor comes down only
 * where a check has stopped being declarative and its selector is gone rather
 * than broken, two at #586, five at #788 and one at #548.
 * @type {Array.<{source: string, least: number}>}
 */
const REACHES = [
  {source: 'stylesheet', least: 177},
  {source: 'pack', least: 431},
  {source: 'selector', least: 42},
]

/**
 * What the grammar and the engine judge differently once the engine is asked
 * on its own, one line each, naming the side that accepts and the gap it
 * stands for; `EXPLAINED` subtracts the engine's own strictness as a class
 * rather than as a list (#680, #738). An empty list is an assertion: eleven
 * stood when #680 wrote it and none is left (#711, #724, #708).
 * @type {Array.<{xpath: string, accepts: string, gap: string}>}
 */
const GAPS = []

/**
 * A tree flattened, its root included, so a property asserted of a node is
 * asserted of every node.
 * @param {object} node - The node to walk down from
 * @return {Array.<object>} - It, and everything standing below it
 */
const walked = function(node) {
  return [node].concat((node.children || []).flatMap((one) => walked(one)))
}

/**
 * The text a node's span slices back to.
 * @param {object} answer - What `parsed` handed back
 * @param {object} node - A node of its tree
 * @return {string} - The tokens it covers, joined
 */
const sliced = function(answer, node) {
  return answer.tokens
    .slice(node.from, node.to).map((token) => token.value).join('')
}

/**
 * Every node in the corpus whose span does not slice back to its own text. A
 * span is a pair of token indices, and this is what makes it a position rather
 * than a bookkeeping detail: the tokens it covers, joined, must be the very
 * characters standing between where the first one starts and where the last
 * one ends. A tree that cannot rebuild its input cannot place a fix in it.
 * @return {Array.<string>} - The strays, each naming its kind and expression
 */
const strayed = function() {
  const astray = []
  for (const one of CORPUS) {
    const answer = parsed(one, '3.0')
    if (answer.fault === '') {
      for (const node of walked(answer.tree)) {
        const first = answer.tokens[node.from]
        const last = answer.tokens[node.to - 1]
        if (node.from >= node.to || sliced(answer, node) !== one.slice(
          first.start, last.start + last.value.length,
        )) {
          astray.push(`${node.kind} in ${one}`)
        }
      }
    }
  }
  return astray
}

/**
 * Every child in the corpus standing outside its parent, or behind the sibling
 * before it. Slicing alone cannot see this: shift a node and its children by
 * one token together and the text still slices, both sides reading the same
 * tokens. Nesting is what pins a span to its construct, and what lets a fix
 * from a child's span land inside its parent.
 * @return {Array.<string>} - The escapes, each naming its kind and expression
 */
const escaped = function() {
  const loose = []
  for (const one of CORPUS) {
    const answer = parsed(one, '3.0')
    if (answer.fault === '') {
      for (const node of walked(answer.tree)) {
        let behind = node.from
        for (const child of node.children || []) {
          if (child.from < behind || child.to > node.to) {
            loose.push(`${child.kind} of ${node.kind} in ${one}`)
          }
          behind = child.to
        }
      }
    }
  }
  return loose
}

/**
 * How a disagreement reads on one line, as an annotation is written.
 * @param {string} accepts - The side that accepts, `grammar` or `engine`
 * @param {string} xpath - The expression they part over
 * @return {string} - The two of them, in one line
 */
const noted = function(accepts, xpath) {
  return `${accepts} alone accepts ${xpath}`
}

/**
 * Which of the two accepts an expression they do not agree about.
 * @param {string} xpath - The expression they part over
 * @return {string} - `grammar` or `engine`
 */
const sided = function(xpath) {
  let side = 'engine'
  if (parsed(xpath, '3.0').fault === '') {
    side = 'grammar'
  }
  return side
}

/**
 * Every disagreement the corpus holds between the grammar and the bare engine.
 * @type {Array.<string>}
 */
const PARTED = CORPUS
  .filter((one) => (parsed(one, '3.0').fault === '') !== compiles(one))

/**
 * The disagreements the engine's own strictness accounts for: a `namespace::`
 * axis, or a gap XPath spells and fontoxpath reads glued. Read from the token
 * stream by `test/strictness.js`, never from either verdict, so subtracting the
 * class below is an account of the engine rather than a restatement of what the
 * grammar happens to do.
 * @type {Array.<string>}
 */
const EXPLAINED = PARTED.filter((one) => insists(one))

/**
 * What is left over, written the way `GAPS` writes one, so membership and
 * direction are one comparison rather than two.
 * @type {Array.<string>}
 */
const UNEXPLAINED = PARTED
  .filter((one) => !insists(one))
  .map((one) => noted(sided(one), one))
  .sort()

describe('grammar over the corpus', function() {
  REACHES.forEach(({source, least}) => {
    it(`cannot answer having read no ${source}`, function() {
      assert.ok(
        new Set(SWEPT[source]).size >= least,
        `the sweep reads ${new Set(SWEPT[source]).size} expressions from ` +
          `every ${source} in the repository, which is fewer than the ` +
          `${least} that stood there when these gates were written`,
      )
    })
  })
  it('cannot lose a character of an expression it was handed', function() {
    assert.deepEqual(
      CORPUS.filter((one) => parsed(one, '3.0').tokens
        .map((token) => token.value).join('') !== one),
      [],
      'some expressions do not come back out of the tokens they were cut into',
    )
  })
  it('cannot span a node over text it did not come from', function() {
    assert.deepEqual(
      strayed(),
      [],
      'some spans do not slice back to the text their node was built from',
    )
  })
  it('cannot let a child stand outside the span of its parent', function() {
    assert.deepEqual(
      escaped(),
      [],
      'some nodes reach past the construct they were built inside',
    )
  })
  it('cannot answer having found the engine nothing to insist about', function() {
    assert.ok(
      EXPLAINED.length >= 40,
      `${EXPLAINED.length} of these expressions are ones the grammar accepts ` +
        'and the engine refuses over its own strictness, against the 40 that ' +
        'stood here when these gates were written: either the class has ' +
        'stopped naming them or the grammar has stopped accepting them, and ' +
        'the subtraction below now stands for almost nothing',
    )
  })
  it('cannot excuse the engine accepting what the grammar refuses', function() {
    assert.deepEqual(
      EXPLAINED.filter((one) => sided(one) === 'engine'),
      [],
      'a spelling the engine takes and our own grammar refuses is being read ' +
        'as the engine being strict, which is an invented defect excused',
    )
  })
  it('cannot part from the engine anywhere it is not accounted for', function() {
    assert.deepEqual(
      UNEXPLAINED,
      GAPS.map(({accepts, xpath}) => noted(accepts, xpath)).sort(),
      'the grammar and the engine part company somewhere unaccounted for',
    )
  })
})
