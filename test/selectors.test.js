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
 * Selectors standing below an anchor: whatever a selector spells in front of
 * its descendant step, which the engine answers once for the document where
 * the sweep behind it costs a traversal per check. Each carries the anchor,
 * the local names the sweep yields and the tail. The fourth interposes a step,
 * so candidates stand below a child of the root (#811).
 * @type {Array.<{xpath: string, anchor: string, locals: Array.<string>,
 *  tail: string}>}
 */
const ANCHORED = [
  {
    xpath: kinds.xpath['using-not-outermost-stylesheet'].xpath,
    anchor: '(/xsl:stylesheet | /xsl:transform)',
    locals: ['stylesheet', 'transform'],
    tail: '',
  },
  {
    xpath: kinds.xpath['function-template-is-not-child-of-stylesheet'].xpath,
    anchor: '(/xsl:stylesheet | /xsl:transform)/*',
    locals: ['function', 'template'],
    tail: '',
  },
  {
    xpath: kinds.xpath['function-use-in-xslt-1'].xpath,
    anchor: '/*[not((if (self::xsl:stylesheet or self::xsl:transform) then ' +
      `@version else @xsl:version) = ('2.0', '3.0'))]`,
    locals: ['function'],
    tail: '',
  },
  {
    xpath: '/xsl:stylesheet//xsl:variable[@name]',
    anchor: '/xsl:stylesheet',
    locals: ['variable'],
    tail: '[@name]',
  },
]

/**
 * Selectors that are a union of branches, each branch an axis and a tail of
 * its own, with the local names and the tail each carries. Three checks are
 * written that way and no shape of theirs is served without it: XPath answers
 * a union in document order over both sides at once, so branches are merged by
 * rank rather than appended (#811).
 * @type {Array.<{xpath: string,
 *  branches: Array.<{locals: Array.<string>, tail: string}>}>}
 */
const UNIONS = [
  {
    xpath: '//xsl:variable | //xsl:template',
    branches: [
      {locals: ['variable'], tail: ''},
      {locals: ['template'], tail: ''},
    ],
  },
  {
    xpath: '//(xsl:variable | xsl:template)[@name] | //xsl:function[@name]',
    branches: [
      {locals: ['variable', 'template'], tail: '[@name]'},
      {locals: ['function'], tail: '[@name]'},
    ],
  },
  {
    xpath: `//xsl:template[contains(@match, '|')] | //xsl:when[@test]`,
    branches: [
      {locals: ['template'], tail: `[contains(@match, '|')]`},
      {locals: ['when'], tail: '[@test]'},
    ],
  },
  {
    xpath: '//xsl:template[@a] | //xsl:variable',
    branches: [
      {locals: ['template'], tail: '[@a]'},
      {locals: ['variable'], tail: ''},
    ],
  },
  {
    xpath: '//xsl:when[not(parent::xsl:choose)] | ' +
      '//xsl:otherwise[not(parent::xsl:choose)]',
    branches: [
      {locals: ['when'], tail: '[not(parent::xsl:choose)]'},
      {locals: ['otherwise'], tail: '[not(parent::xsl:choose)]'},
    ],
  },
]

/**
 * Selectors no index may serve, each with why. A wildcard names no bucket; a
 * root-anchored path is not a descendant sweep; an attribute is not an
 * element; a step behind the predicate reaches past what the axis answered; an
 * unbound prefix resolves to no namespace; and a positional predicate reads
 * the whole sequence's position.
 * @type {Array.<{xpath: string, why: string}>}
 */
const WHOLE = [
  {xpath: '//xsl:*', why: 'a wildcard names no one bucket'},
  {
    xpath: '/*[not(@version)]//xsl:template/@match',
    why: 'an attribute axis below an anchor',
  },
  {
    xpath: `/*[not(@version)]${kinds.corpus['unused-variable'].usage}`,
    why: 'every attribute below an anchor',
  },
  {xpath: '//*', why: 'every element is not a name'},
  {xpath: '//(xsl:variable | xsl:*)', why: 'a wildcard inside a union'},
  {xpath: '/*[not(@version)]', why: 'the root itself, not a descendant sweep'},
  {xpath: '//xsl:template[@match]/xsl:param', why: 'a step behind the tail'},
  {xpath: '//mine:thing[@a]', why: 'a prefix nothing binds'},
  {xpath: '//xsl:template[1]', why: 'a positional predicate'},
  {
    xpath: '//xsl:variable | /xsl:stylesheet',
    why: 'a union whose second branch is the root itself',
  },
  {
    xpath: '//xsl:variable | //xsl:template[1]',
    why: 'a union whose second branch reads a position',
  },
  {
    xpath: '//xsl:variable | //xsl:*',
    why: 'a union whose second branch names no bucket',
  },
  {
    xpath: '//xsl:variable/@name | //xsl:template/@match',
    why: 'a union of attribute axes, the walk ranking elements alone',
  },
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
 * A stylesheet where every union's branches interleave, which is what a merge
 * is judged on: a second-branch hit stands ahead of a first-branch one, so
 * appending bucket to bucket answers the right nodes in the wrong order. The
 * first spelling interleaved none and read green without the rank sort, and no
 * corpus file holds both branches of a check (#645, #811).
 * @type {Document}
 */
const MERGING = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(__dirname, 'resources', 'selectors', 'unions.xsl'),
    'utf-8',
  ),
)

/**
 * Unions the door is judged on against the engine: the three checks written as
 * one, plus two buckets that interleave, one entered twice under different
 * tails, a branch written twice, and one that finds nothing. A fourth rides
 * along for the other half of an anchor — this sheet is 3.0, so its guard
 * answers nothing and the two functions go unreported (#811).
 * @type {Array.<string>}
 */
const MERGED = [
  kinds.xpath['short-names'].xpath,
  kinds.xpath['function-use-in-xslt-1'].xpath,
  kinds.xpath['name-starts-with-numeric'].xpath,
  kinds.xpath['when-or-otherwise-outside-choose'].xpath,
  '//xsl:variable | //xsl:template',
  '//xsl:template[@name] | //xsl:template[@match]',
  '//xsl:template[@name] | //xsl:template[@name]',
  '//xsl:variable | //xsl:sort',
]

/**
 * A stylesheet whose elements stand at depths an anchor tells apart: a
 * template and a function below the root, an `xsl:stylesheet` nested in a
 * template, a template and a function inside that, and an `xsl:transform`
 * below the root again. So each anchor excludes what the sweep behind it would
 * reach, where a served axis over-reports (#811).
 * @type {Document}
 */
const ANCHORING = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(__dirname, 'resources', 'selectors', 'anchored.xsl'),
    'utf-8',
  ),
)

/**
 * Anchored selectors the door is judged on against the engine: the three
 * checks as written, one whose branches carry an anchor apiece, and one whose
 * anchor names an element the stylesheet does not hold. That last is the
 * assertion the others cannot make — an anchor answering nothing must answer
 * no candidates.
 * @type {Array.<string>}
 */
const DESCENDED = [
  kinds.xpath['using-not-outermost-stylesheet'].xpath,
  kinds.xpath['function-template-is-not-child-of-stylesheet'].xpath,
  kinds.xpath['function-use-in-xslt-1'].xpath,
  '/xsl:stylesheet/*//xsl:function | /xsl:stylesheet//xsl:transform',
  '/xsl:nothing//xsl:template',
]

/**
 * Predicate spellings the split is judged on, with no verdict written beside
 * any of them: the engine answers what each selects and the test asks whether
 * an axis answers the same, so a row is a question rather than a claim a table
 * would have to be right about twice (#784). The digit scan could not give
 * that: `[count(a)]` holds none and picks a position.
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
 * Whole selectors the two doors are judged on, served and unserved alike,
 * since what they promise is one answer whichever way it was reached. Four of
 * the six are served — one bucket, two merged by rank, one attribute off each
 * element, and every attribute of the document, read off the check. The other
 * two are refused, at the root and on a positional predicate.
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
  SPLIT.concat(ANCHORED).forEach((one) => {
    it(`splits ${one.xpath} into an axis and a tail`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath),
        [
          {
            names: one.locals.map((local) => ({uri: XSLT, local: local})),
            attributes: [],
            anchor: one.anchor ?? '',
            tail: one.tail,
          },
        ],
        `the selector ${one.xpath} is not split the way an index needs it`,
      )
    })
  })
  ATTRIBUTED.forEach((one) => {
    it(`splits ${one.xpath} into an attribute axis and a tail`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath),
        [
          {
            names: one.locals.map((local) => ({uri: XSLT, local: local})),
            attributes: [one.attribute],
            anchor: '',
            tail: one.tail,
          },
        ],
        `the selector ${one.xpath} is not split the way an index needs it`,
      )
    })
  })
  it('serves the every-attribute usage three cross-file checks are written in',
    function() {
      assert.deepStrictEqual(
        splitOf(kinds.corpus['unused-variable'].usage),
        [
          {
            names: [], attributes: [{uri: '', local: EVERY}],
            anchor: '', tail: '',
          },
        ],
        'the usage selector of three of the four cross-file checks chooses ' +
          'every attribute of a document, which is the sequence the walk in ' +
          'src/tree.js already holds and remembers, and it is not being split ' +
          'off the engine',
      )
    })
  it('serves the named-attribute usage the fourth is written in', function() {
    assert.deepStrictEqual(
      splitOf(kinds.corpus['unused-named-template'].usage),
      [
        {
          names: [{uri: XSLT, local: 'call-template'}],
          attributes: [{uri: '', local: 'name'}],
          anchor: '',
          tail: '',
        },
      ],
      'the usage selector naming one attribute of one element is not being ' +
        'split off the engine',
    )
  })
  UNIONS.forEach((one) => {
    it(`parts ${one.xpath} into a branch apiece`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath),
        one.branches.map((branch) => ({
          names: branch.locals.map((local) => ({uri: XSLT, local: local})),
          attributes: [],
          anchor: '',
          tail: branch.tail,
        })),
        `the union ${one.xpath} is not parted into the branches an index ` +
          'serves one at a time, so both halves go to the engine as one ' +
          'descendant sweep apiece',
      )
    })
  })
  it('refuses an attribute axis standing in a bracketed union',
    function() {
      assert.deepStrictEqual(
        splitOf(kinds.xpath['malformed-version-in-stylesheet'].xpath),
        [],
        'a union wearing one predicate outside its brackets is a shape the ' +
          'split does not part, so the attribute axis inside each half of ' +
          'one is refused with it',
      )
    })
  WHOLE.forEach((one) => {
    it(`refuses ${one.xpath}, being ${one.why}`, function() {
      assert.deepStrictEqual(
        splitOf(one.xpath),
        [],
        `the selector ${one.xpath} is served from an index though it is ` +
          `${one.why}, so the index answers a question the selector never put`,
      )
    })
  })
  MERGED.forEach((one) => {
    it(`merges ${one} as the engine orders it`, function() {
      assert.deepStrictEqual(
        placed(chosen(MERGING, one)),
        placed(nodes(MERGING, one)),
        `the nodes served for the union ${one} are not the nodes the engine ` +
          'chooses in the order it chooses them, so a union is being ' +
          'appended bucket after bucket rather than merged by rank, or a ' +
          'node standing in two branches is reported twice',
      )
    })
  })
  DESCENDED.forEach((one) => {
    it(`serves ${one} where the engine reaches the same nodes`, function() {
      assert.deepStrictEqual(
        placed(chosen(ANCHORING, one)),
        placed(nodes(ANCHORING, one)),
        `the nodes served for ${one} are not the nodes the engine reaches ` +
          'below its anchor, so an axis is being answered without the anchor ' +
          'that stands in front of it and reports nodes the selector never ' +
          'selected',
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
