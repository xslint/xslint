/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {EVERY, chosen, splitOf, valued} = require('../src/selectors')
const {nodes, strings} = require('../src/xpath')
const {xml} = require('../src/helpers')
const {kinds} = require('../src/resources/checks.json')

/**
 * The XSLT namespace, which is the only one a declarative selector names on the
 * axis today.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * Selectors an index can serve, each with the local names its axis yields and
 * the tail left for the predicate. A union is one entry rather than several,
 * since what the axis answers is one sequence in document order.
 * @type {Array.<{xpath: string, locals: Array.<string>, tail: string}>}
 */
const SPLIT = [
  {xpath: '//xsl:variable', locals: ['variable'], tail: ''},
  {xpath: '//xsl:variable[@name]', locals: ['variable'], tail: '[@name]'},
  {
    xpath: '//(xsl:variable | xsl:template)[string-length(@name) = 1]',
    locals: ['variable', 'template'],
    tail: '[string-length(@name) = 1]',
  },
  {
    xpath: '//xsl:param[parent::xsl:template][preceding-sibling::*]',
    locals: ['param'],
    tail: '[parent::xsl:template][preceding-sibling::*]',
  },
  {
    xpath: `//xsl:template[contains(@match, '[')]`,
    locals: ['template'],
    tail: `[contains(@match, '[')]`,
  },
  {
    xpath: '//(xsl:if|xsl:when)[normalize-space(@test) = "x"]',
    locals: ['if', 'when'],
    tail: '[normalize-space(@test) = "x"]',
  },
  {
    xpath: '//xsl:variable[ancestor::xsl:template[1]]',
    locals: ['variable'],
    tail: '[ancestor::xsl:template[1]]',
  },
]

/**
 * Selectors whose axis is one attribute of named elements, each with the
 * element names it is taken off, the attribute itself, and the tail left for
 * the predicate. The attributes of a document are walked and remembered exactly
 * as its elements are (#811).
 * @type {Array.<{xpath: string, locals: Array.<string>,
 *  attribute: {uri: string, local: string}, tail: string}>}
 */
const ATTRIBUTED = [
  {
    xpath: '//xsl:template/@match',
    locals: ['template'],
    attribute: {uri: '', local: 'match'},
    tail: '',
  },
  {
    xpath: '//(xsl:variable | xsl:param)/@name[string-length(.) = 1]',
    locals: ['variable', 'param'],
    attribute: {uri: '', local: 'name'},
    tail: '[string-length(.) = 1]',
  },
  {
    xpath: '//xsl:output/@xsl:version',
    locals: ['output'],
    attribute: {uri: XSLT, local: 'version'},
    tail: '',
  },
]

/**
 * Selectors no index may serve, each with why. A wildcard names no bucket; a
 * root-anchored path is not a descendant sweep; an attribute is not an element;
 * a step behind the predicate reaches past what the axis answered; a prefix
 * this project does not bind cannot be resolved to a namespace; and a
 * positional predicate reads the position of the whole descendant sequence,
 * which one candidate at a time cannot supply.
 * @type {Array.<{xpath: string, why: string}>}
 */
const WHOLE = [
  {xpath: '//xsl:*', why: 'a wildcard names no one bucket'},
  {xpath: '//*', why: 'every element is not a name'},
  {xpath: '//(xsl:variable | xsl:*)', why: 'a wildcard inside a union'},
  {xpath: '/*[not(@version)]', why: 'anchored at the root, not a sweep'},
  {xpath: '//xsl:template[@match]/xsl:param', why: 'a step behind the tail'},
  {xpath: '//mine:thing[@a]', why: 'a prefix nothing binds'},
  {xpath: '//xsl:template[1]', why: 'a positional predicate'},
  {
    xpath: '//xsl:template[1][@match]',
    why: 'a positional predicate ahead of another',
  },
  {
    xpath: '//xsl:template[@match][1]',
    why: 'a positional predicate behind another',
  },
  {xpath: '//xsl:variable[2 - 1]', why: 'arithmetic worth a position'},
  {
    xpath: '//xsl:variable[a/count(.)]',
    why: 'a path whose last step answers a number',
  },
  {
    xpath: '//xsl:variable[a/(count(.))]',
    why: 'a path ending in a bracket of the author own',
  },
  {
    xpath: '//xsl:variable[a/count(.)[1]]',
    why: 'a path ending in a predicate of its own',
  },
  {
    xpath: '//xsl:variable[descendant::a/string-length(.)]',
    why: 'a number behind a descendant step',
  },
  {xpath: '//xsl:variable[1 + 1]', why: 'arithmetic worth another position'},
  {xpath: '//xsl:variable[1.0]', why: 'a position spelled as a decimal'},
  {xpath: '//xsl:variable[- 1]', why: 'a position behind a sign'},
  {xpath: '//xsl:variable[number("2")]', why: 'a call answering a number'},
  {xpath: '//xsl:variable[count(@name)]', why: 'a count answering a number'},
  {
    xpath: '//xsl:variable[@name][2 - 1]',
    why: 'arithmetic behind another predicate',
  },
  {
    xpath: '//xsl:variable[@name = position()]',
    why: 'position() inside a comparison',
  },
  {
    xpath: '//xsl:variable[not(@name = last())]',
    why: 'last() buried two calls deep',
  },
  {
    xpath: '//xsl:variable[Q{http://www.w3.org/2005/xpath-functions}not(@a)]',
    why: 'a call naming its namespace inline',
  },
  {xpath: '//xsl:variable[(@name)]', why: 'a bracket of the author own'},
  {xpath: '//xsl:variable[@name and]', why: 'a predicate that cannot parse'},
  {xpath: '//xsl:template[position() = 1]', why: 'position() in the tail'},
  {xpath: '//xsl:template[last()]', why: 'last() in the tail'},
  {xpath: '//xsl:template[@a] | //xsl:variable', why: 'a union of paths'},
  {xpath: 'xsl:template[@a]', why: 'no descendant axis at all'},
  {xpath: '//xsl:template/@*', why: 'every attribute of a named element'},
  {xpath: '//xsl:template/@mine:thing', why: 'a prefix nothing binds'},
  {
    xpath: '//xsl:template/@name[1]',
    why: 'a positional predicate on an attribute',
  },
  {xpath: '//xsl:template/@name/@x', why: 'an attribute behind an attribute'},
  {xpath: '//xsl:template/@name/..', why: 'a step behind the attribute'},
  {
    xpath: '//(xsl:variable | xsl:param)/@name/xsl:x',
    why: 'a step behind an attribute off a union',
  },
]

/**
 * The stylesheet the two answers are compared over: four variables of distinct
 * names, holding one `a`, two, none, and one whose `@x` is zero — so a
 * predicate that picks a position answers differently from one that filters,
 * which a document of identical elements could not show.
 * @type {Document}
 */
const SHEET = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(__dirname, 'resources', 'selectors', 'candidates.xsl'),
    'utf-8',
  ),
)

/**
 * The axis every candidate below hangs off, spelled out because what is under
 * test is the **tail**: whether the predicate a selector wrote answers the
 * same asked of one candidate at a time as it does asked of the whole sequence
 * a descendant step produced. How the axis itself is gathered is the index's
 * question, and `test/conformance.test.js` puts that one.
 * @type {string}
 */
const AXIS = '//xsl:variable'

/**
 * Predicate spellings the split is judged on, with no verdict written down
 * beside any of them. The engine answers what each one selects and the test
 * asks whether serving it from an axis answers the same, so a row is a
 * question rather than a claim — a table of expectations would have to be
 * right about XPath twice, once in `filters` and once beside it, where a
 * spelling nobody predicted is exactly what this is for (#784). That is what
 * the digit scan of the first spelling could not give: `[count(a)]` and
 * `[a/count(.)]` hold no digit at all and pick a position all the same.
 * @type {Array.<string>}
 */
const CANDIDATES = [
  '@name', 'not(@name)', '@name = "one"', 'string-length(@name) = 3',
  'a', 'a/b', 'a[@x]', 'a/@x', 'b', 'a | b', '(a)',
  'count(a) = 1', 'count(a) >= 2', 'not(a/count(.))', '@name = a/count(.)',
  '1', '2 - 1', '1.0', '- 1', 'number("2")', 'count(a)',
  'string-length(@name)', 'position() = 1', 'last()', 'a[position() = 1]',
  'a/count(.)', 'a/(count(.))', 'a/count(.)[1]', 'a/number(@x)',
  'a/string-length(@x)', 'descendant::a/count(.)',
  'self::xsl:variable/count(.)',
]

/**
 * Whole selectors the two doors are judged on, served and unserved alike, since
 * what they promise is one answer whichever way it was reached. Four of these
 * six are served — elements of one bucket, of two merged by rank, one attribute
 * off each element, and every attribute of the document, which is the usage
 * three of the four cross-file checks are written in and is read off the check
 * rather than spelled again. The other two are refused, at the root and on a
 * positional predicate, and go whole to the engine.
 * @type {Array.<string>}
 */
const DOORS = [
  AXIS,
  '//(xsl:variable | xsl:param)',
  '//xsl:variable/@name',
  kinds.corpus['unused-variable'].usage,
  '/xsl:stylesheet/xsl:variable',
  '//xsl:variable[1]',
]

/**
 * Where each node of a selection stands, which is how two answers are compared
 * without asking either of them what kind of node it holds: an attribute
 * answers no `getAttribute` and an element no `value`, where both carry the
 * place the parser read them at. Order is part of the answer, a report being
 * printed in the order the linters push.
 * @param {Array.<Node>} found - What a selector answered
 * @return {Array.<string>} - Each node's name and place, in order
 */
const placed = function(found) {
  return found.map(
    (node) => `${node.nodeName} ${node.lineNumber}:${node.columnNumber}`,
  )
}

/**
 * The names a selection carries, or an error where the engine refuses to answer
 * at all — `[not(a/count(.))]` asks for the effective boolean value of two
 * numbers, which is FORG0006 whichever way the question is put. Both sides are
 * read the same way, so a raise on one side alone is a disagreement like any
 * other rather than a row nobody can judge.
 * @param {function(): Array.<Node>} selection - What to ask for
 * @return {Array.<string>} - The names it answers, in order
 */
const answered = function(selection) {
  let names = ['error']
  try {
    names = selection().map((node) => node.getAttribute('name'))
  } catch (refusal) {
    names = ['error', refusal.message.slice(0, 8)]
  }
  return names
}

describe('selectors', function() {
  SPLIT.forEach((one) => {
    it(`splits ${one.xpath} into an axis and a tail`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath),
        {
          names: one.locals.map((local) => ({uri: XSLT, local: local})),
          attributes: [],
          tail: one.tail,
        },
        `the selector ${one.xpath} is not split the way an index needs it`,
      )
    })
  })
  ATTRIBUTED.forEach((one) => {
    it(`splits ${one.xpath} into an attribute axis and a tail`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath),
        {
          names: one.locals.map((local) => ({uri: XSLT, local: local})),
          attributes: [one.attribute],
          tail: one.tail,
        },
        `the selector ${one.xpath} is not split the way an index needs it`,
      )
    })
  })
  it('serves the every-attribute usage three cross-file checks are written in',
    function() {
      assert.deepStrictEqual(
        splitOf(kinds.corpus['unused-variable'].usage),
        {names: [], attributes: [{uri: '', local: EVERY}], tail: ''},
        'the usage selector of three of the four cross-file checks chooses ' +
          'every attribute of a document, which is the sequence the walk in ' +
          'src/tree.js already holds and remembers, and it is not being split ' +
          'off the engine',
      )
    })
  it('serves the named-attribute usage the fourth is written in', function() {
    assert.deepStrictEqual(
      splitOf(kinds.corpus['unused-named-template'].usage),
      {
        names: [{uri: XSLT, local: 'call-template'}],
        attributes: [{uri: '', local: 'name'}],
        tail: '',
      },
      'the usage selector naming one attribute of one element is not being ' +
        'split off the engine',
    )
  })
  it('refuses an attribute axis standing in a union of two whole paths',
    function() {
      assert.deepStrictEqual(
        splitOf(kinds.xpath['malformed-version-in-stylesheet'].xpath)
          .attributes,
        [],
        'a union of two whole paths is one selector the split does not part, ' +
          'whichever axis each half stands on, so an attribute axis inside ' +
          'one is refused with it',
      )
    })
  WHOLE.forEach((one) => {
    it(`refuses ${one.xpath}, being ${one.why}`, function() {
      assert.deepStrictEqual(
        [splitOf(one.xpath).names, splitOf(one.xpath).attributes],
        [[], []],
        `the selector ${one.xpath} is served from an index though it is ` +
          `${one.why}, so the index answers a question the selector never put`,
      )
    })
  })
  CANDIDATES.forEach((one) => {
    const xpath = `${AXIS}[${one}]`
    it(`answers [${one}] as the engine reads it, or serves it not at all`,
      function() {
        assert.deepStrictEqual(
          answered(() => chosen(SHEET, xpath)),
          answered(() => nodes(SHEET, xpath)),
          `serving ${xpath} from an axis answers something else than the ` +
            'engine answers of the whole selector, so the predicate reads ' +
            'the sequence it stands in and cannot be asked of one candidate',
        )
      })
  })
  DOORS.forEach((one) => {
    it(`chooses ${one} where the engine chooses the same nodes`, function() {
      assert.deepStrictEqual(
        placed(chosen(SHEET, one)),
        placed(nodes(SHEET, one)),
        `the nodes served for ${one} are not the nodes the engine chooses in ` +
          'the order it chooses them, and a report is printed in the order ' +
          'the linters push',
      )
    })
  })
  DOORS.forEach((one) => {
    it(`values ${one} where the engine reads the same strings`, function() {
      assert.deepStrictEqual(
        valued(SHEET, one),
        strings(SHEET, one),
        `the strings served for ${one} are not the string values the engine ` +
          'reads, so a cross-file check would judge a declaration against ' +
          'usage text nobody wrote',
      )
    })
  })
})
