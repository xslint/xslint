/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parsed} = require('../src/grammar')
const {isValid} = require('../src/xpath')
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
  let held = []
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
        found.stylesheet.push(...carried(fs.readFileSync(file, 'utf8')))
      }
      if (file.endsWith('.yaml')) {
        const pack = yaml.parsedFromFile(file)
        for (const input of pack.inputs || [pack.input]) {
          if (typeof input === 'string') {
            found.pack.push(...carried(input))
          }
        }
        found.selector.push(...SELECTORS
          .filter((key) => typeof pack[key] === 'string')
          .map((key) => pack[key]))
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
 * pass by finding nothing, so the sweep is gated too.
 * @type {Array.<{source: string, least: number}>}
 */
const REACHES = [
  {source: 'stylesheet', least: 120},
  {source: 'pack', least: 300},
  {source: 'selector', least: 40},
]

/**
 * Every expression in the corpus the grammar and the engine judge differently,
 * one line each, naming the side that accepts and the gap it stands for.
 *
 * All of them are gaps in ours. None is the engine refusing a spelling the
 * grammar allows, which is the #639-family strictness the respelling retry in
 * `src/xpath.js` exists to work around — #680 expected this diff to collect
 * that evidence, and it collects none, because no fixture holds an expression
 * the engine is wrong about. Retiring the retry needs a corpus that reaches it.
 *
 * Ten of the eleven are a selector, though a selector is one expression in
 * twelve here: the checks are written in an idiom the stylesheets never use.
 * @type {Array.<{xpath: string, accepts: string, gap: string}>}
 */
const GAPS = [
  {
    xpath: 'my:25l(3)',
    accepts: 'grammar',
    gap: 'a name no NCName can spell (#708)',
  },
  {
    xpath: '//( xsl:if | xsl:when)[not(@test)]',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '//(xsl:variable | xsl:param)[not(@name)]',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '//(xsl:variable | xsl:param | xsl:with-param)[@select and (* or ' +
      'text()[normalize-space()])]',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '(/xsl:stylesheet | /xsl:transform)//(xsl:stylesheet | ' +
      'xsl:transform)',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '(/xsl:stylesheet | /xsl:transform)/*//(xsl:function|xsl:template)',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '//(xsl:function | xsl:template)/xsl:param[not(some $x in ' +
      '..//(node() | @*) satisfies contains($x, concat(\'$\', @name)))]',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '/*[if (self::xsl:*) then not(@version) else (not(@xsl:version) ' +
      'and .//xsl:* and not(.//(xsl:stylesheet | xsl:transform | ' +
      'xsl:package)))]',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '/*[(if (self::xsl:stylesheet or self::xsl:transform) then ' +
      '@version else @xsl:version) = \'1.0\']//(xsl:for-each-group | ' +
      'xsl:sequence | xsl:analyze-string | xsl:next-match | xsl:perform-sort ' +
      '| xsl:namespace | xsl:character-map | xsl:result-document | ' +
      'xsl:import-schema | xsl:*[@as])',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '((//xsl:template | //xsl:key | //xsl:accumulator-rule)/@match | ' +
      '//xsl:number/(@count | @from) | //xsl:for-each-group/' +
      '(@group-starting-with | @group-ending-with))' +
      '[starts-with(normalize-space(), \'//\')]',
    accepts: 'engine',
    gap: 'a parenthesized expression standing as a step (#711)',
  },
  {
    xpath: '//xsl:apply-templates[some $var in ancestor::xsl:template[1]' +
      '//xsl:variable satisfies (($var << .) and (starts-with(@select, ' +
      'concat($var/@name, \'/\')) or @select=$var/@name))]',
    accepts: 'engine',
    gap: 'a node comparison operator (#708)',
  },
]

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
 * one token together and the text still slices, because both sides of that
 * comparison read the same tokens. Nesting is the property that pins a span to
 * the construct it belongs to, and it is what lets a fix built from a child's
 * span be trusted to land inside its parent.
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
 * Every disagreement the corpus holds, written the way `GAPS` writes one, so
 * membership and direction are one comparison rather than two.
 * @type {Array.<string>}
 */
const PARTED = CORPUS
  .filter((one) => (parsed(one, '3.0').fault === '') !== isValid(one))
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
  it('cannot part from the engine anywhere it is not annotated', function() {
    assert.deepEqual(
      PARTED,
      GAPS.map(({accepts, xpath}) => noted(accepts, xpath)).sort(),
      'the grammar and the engine part company somewhere unaccounted for',
    )
  })
})
