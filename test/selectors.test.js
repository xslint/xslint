/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {EVERY, answered, chosen, splitOf, valued} = require('../src/selectors')
const {nodes, strings} = require('../src/xpath')
const {xml, yaml} = require('../src/helpers')
const {kinds} = require('../src/resources/checks.json')
const {worded} = require('./guides')

/**
 * The XSLT namespace, which is the only one a declarative selector names on the
 * axis today.
 * @type {string}
 */
const XSLT = 'http://www.w3.org/1999/XSL/Transform'

/**
 * The rows of five tables below whose selector opens on a bare attribute
 * sweep. A check spells one in YAML and this file cannot: `//@name` is an
 * ESLint error in every JavaScript here, a linter narrowing to one attribute
 * through `whole` instead, so the subjects of the split are read in the
 * language a check is written in rather than transcribed into another (#811).
 * @type {{attributed: Array.<object>, merged: Array.<string>,
 *  distributed: Array.<string>, whole: Array.<object>,
 *  unspilled: Array.<object>}}
 */
const AXES = yaml.parsedFromFile(
  path.resolve(__dirname, 'resources', 'selectors', 'axes.yaml'),
)

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
  {xpath: '//xsl:*', locals: [EVERY], tail: ''},
  {
    xpath: '//(xsl:variable | xsl:*)',
    locals: ['variable', EVERY],
    tail: '',
  },
  {
    xpath: '//(xsl:variable | xsl:*)[@select]',
    locals: ['variable', EVERY],
    tail: '[@select]',
  },
  {
    xpath: kinds.xpath['text-outside-xsl-text'].xpath,
    locals: [EVERY],
    tail: kinds.xpath['text-outside-xsl-text'].xpath.slice('//xsl:*'.length),
  },
]

/**
 * Selectors whose axis is an attribute, each with the element names it is
 * taken off, the attribute itself, and the tail left for the predicate. The
 * walk remembers a document's attributes as it does its elements, so one
 * named off no element at all is that walk filtered by name — the shape a
 * distributed union leaves behind, and the one no row here can spell (#811).
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
  {
    xpath: '//xsl:*/@name',
    locals: [EVERY],
    attribute: {uri: '', local: 'name'},
    tail: '',
  },
].concat(AXES.attributed)

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
    tail: '[not(ancestor::xsl:override)]',
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
 * Selectors no index may serve, each beside what puts it out of reach: a bare
 * wildcard naming no namespace to gather from, a root-anchored path that is
 * no descendant sweep, a step behind the predicate reaching past what the
 * axis answered, an unbound prefix, a name that buckets to nothing, and a
 * position, which reads the whole sequence.
 * @type {Array.<{xpath: string, why: string}>}
 */
const WHOLE = [
  {
    xpath: '//*/@name',
    why: 'an attribute named off every element there is',
  },
  {
    xpath: '//mine:thing/@name',
    why: 'an attribute named off a prefix nothing binds',
  },
  {
    xpath: '/*[not(@version)]//xsl:template/@match',
    why: 'an attribute axis below an anchor',
  },
  {
    xpath: `/*[not(@version)]${kinds.corpus['unused-variable'].usage}`,
    why: 'every attribute below an anchor',
  },
  {xpath: '//*', why: 'every element is not a name'},
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
    xpath: '//xsl:variable | //*',
    why: 'a union whose second branch names no bucket',
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
  {xpath: '//xsl:variable[(1)]', why: 'a position under a bracket'},
  {
    xpath: '//xsl:variable[(@name, @as)]',
    why: 'a sequence under a bracket, which no one kind settles',
  },
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
].concat(AXES.whole)

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
 * Unions the door is judged on against the engine: the three checks written
 * as one, plus two buckets that interleave, one entered twice under
 * different tails, a branch written twice, one that finds nothing, and a
 * fourth whose 3.0 guard answers nothing. The last three set a wildcard
 * beside a name of its own namespace, which reaches all that name does.
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
  '//xsl:variable/@name | //xsl:template/@match',
  '//xsl:variable | //xsl:*',
  '//(xsl:variable | xsl:*)',
  '//(xsl:variable | xsl:*)[@select]',
].concat(AXES.merged)

/**
 * A stylesheet declaring versions two arms of one union reach: a root and two
 * literal result elements no XSLT version names, beside an `xsl:output` and a
 * third element the check leaves alone. So a distributed union is judged where
 * both its arms answer something and each excludes what the other reports.
 * @type {Document}
 */
const DISTRIBUTING = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(__dirname, 'resources', 'selectors', 'distributed.xsl'),
    'utf-8',
  ),
)

/**
 * Unions wearing one predicate outside their brackets, which is `(A | B)[P]`
 * and answers what `A[P] | B[P]` answers, a predicate distributing over a set.
 * The first is the check the shape was found in; the rest carry two attribute
 * arms, two element arms, an arm answering nothing, and an outer predicate
 * standing behind an inner one.
 * @type {Array.<string>}
 */
const DISTRIBUTED = [
  kinds.xpath['malformed-version-in-stylesheet'].xpath,
  '(//xsl:template | //xsl:variable)[@name]',
].concat(AXES.distributed)

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
 * The note whose paragraph states how wide that oracle is, and the shape of
 * the statement. It has drifted twice, a row count being a figure nothing
 * reads once the sweep it describes is a `concat` of two tables, so it is held
 * here rather than beside the guides' own gate, which weighs sizes (#811).
 * @type {{note: string, claim: RegExp}}
 */
const WIDE = {
  note: 'test/predicates.test.js', claim: /the oracle, (\d+) rows here/g,
}

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
  '@select', 'not(@select)', '@as', 'not(@as)', '@match', '@mode',
  '@select and @as', '@select or @as', 'not(@select or @as)',
  'not(@select) and not(@as)', 'not(@match) and (@mode or @priority)',
  '@name = "nine"', '@name = ("one", "three")', 'not(@name = "one")',
  '@name != "one"', '@select = "\'v\'"', 'string-length(@name) = 4',
  'string-length(@name) >= 4', 'string-length(@name) > 3',
  'string-length(@select) = 3', 'count(*) = 1', 'count(*) >= 2',
  'not(*)', '*', 'count(a) = count(*)', 'count(a[@x]) = 1',
  'a[not(@x)]', 'a[@x = "1"]', 'self::xsl:variable', 'not(self::xsl:param)',
  'parent::xsl:stylesheet', 'not(parent::xsl:stylesheet)',
  'parent::xsl:template', 'parent::*', 'parent::*[not(self::xsl:template)]',
  '(@select)', '((@select))', '(@select and @as) or @mode',
  '@name = "one" and count(a) = 1', 'xsl:sort', 'not(xsl:sort)',
  'count(*) != 1', 'count(*) < 2', 'count(*) <= 1', '@name/@x',
  'substring-after(@name, "o") = "ne"',
  'string-length(substring-after(@nope, @also)) = 0',
  'following-sibling::*', 'not(ancestor::xsl:template)',
  'preceding-sibling::*[not(self::xsl:variable)]',
  'parent::*[not(self::xsl:*)]', 'not(contains(@name, "n"))',
  'not(contains(@name, @nope))', 'contains(@name, @nope)',
  'string-length(@name) = 1',
  'string-length(substring-after(@name, ":")) = 1',
  'xsl:text', 'xsl:text = "alpha"',
  'normalize-space(xsl:text) = "alpha"',
  'xsl:variable/xsl:text = "alpha"',
  'not(xsl:variable/xsl:text = "alpha")',
  '@name = preceding-sibling::xsl:variable/@name',
  'count(.//xsl:*) = 1', 'count(.//xsl:*) >= 2', 'count(.//xsl:*) = 0',
  './/xsl:text', 'not(.//xsl:text)', './/a', 'count(descendant::xsl:*) = 1',
  '//xsl:text', 'xsl:variable//xsl:text', './xsl:text',
  'count(descendant-or-self::xsl:*) >= 2',
  'count(*) = 1 and not(text()[normalize-space()])',
  '@select and //xsl:text', '//xsl:text and @select',
  '@select and //xsl:nothing', 'not(node()) and @select',
  'not(@select) and not(@_select) and not(node())',
  '@name = "ten" and //xsl:text and count(*) = 1',
  'not(text()[normalize-space()]) and (@select or @as)',
  '2 and @select', '@select and 2', 'count(a) and @name = "two"',
  '(@select)', '((@select))', '(@select and @as)', '(@select or @as)',
  '(count(*) = 1) and (count(a) = 1)', '@select and (@as or @mode)',
  '(@select) and //xsl:text', '(2) and @select', '(@name, @as)',
]

/**
 * Every attribute of a document, which is the second head below and is read
 * off the check spelling it rather than written out — a bare `//@` in the
 * source is banned outright, nothing in `src/` having a use for one.
 * @type {string}
 */
const ATTRIBUTES = kinds.corpus['unused-variable'].usage

/**
 * Predicate spellings asked of a head other than `AXIS`, because the head
 * decides what **kind** of node a predicate is handed and every row here is
 * about that. An attribute is one such kind, having no parent in the DOM at
 * all but an owner element, and the root element is the other, whose parent
 * is a document that no wildcard may admit as one.
 * @type {Array.<{head: string, predicate: string}>}
 */
const HEADED = [
  {head: ATTRIBUTES, predicate: 'parent::xsl:variable'},
  {head: ATTRIBUTES, predicate: 'not(parent::xsl:variable)'},
  {head: ATTRIBUTES, predicate: 'parent::*'},
  {head: ATTRIBUTES, predicate: 'parent::*[@name]'},
  {head: ATTRIBUTES, predicate: 'ancestor::xsl:template'},
  {head: ATTRIBUTES, predicate: 'not(ancestor::xsl:stylesheet)'},
  {head: ATTRIBUTES, predicate: 'self::node()'},
  {head: '//xsl:stylesheet', predicate: 'parent::*'},
  {head: '//xsl:stylesheet', predicate: 'not(parent::*)'},
  {head: '//xsl:stylesheet', predicate: 'ancestor::*'},
  {head: ATTRIBUTES, predicate: 'parent::xsl:variable and //xsl:text'},
  {head: ATTRIBUTES, predicate: '2 and parent::xsl:variable'},
]

/**
 * Whole selectors the two doors are judged on, served and unserved alike,
 * since what they promise is one answer whichever way it was reached. Five of
 * the seven are served — one bucket, two merged by rank, one attribute off
 * each element, every attribute of the document, and one off every element
 * of a namespace — and two are refused, at the root and on a position.
 * @type {Array.<string>}
 */
const DOORS = [
  AXIS,
  '//(xsl:variable | xsl:param)',
  '//xsl:variable/@name',
  kinds.corpus['unused-variable'].usage,
  '/xsl:stylesheet/xsl:variable',
  '//xsl:variable[1]',
  '//xsl:*/@name',
]

/**
 * A stylesheet whose XSLT elements interleave with elements of another
 * namespace and with each other, so that a union of a named arm and a wider
 * one has something to get wrong: three `xsl:variable` stand in the answer of
 * both arms and must be selected once apiece, and the nodes only one arm
 * reaches stand between them rather than after them.
 * @type {Document}
 */
const APARTING = xml.parsedFromString(
  fs.readFileSync(
    path.resolve(__dirname, 'resources', 'selectors', 'apart.xsl'), 'utf-8',
  ),
)

/**
 * Unions no single axis can carry, because the arms carry different tails or
 * because one of them names no bucket. Each is served by the arms that can be
 * and swept by the arms that cannot, which is what makes them different from
 * `WHOLE`: refusing the whole selector for one arm is what this table exists
 * to stop.
 * @type {Array.<{xpath: string, why: string}>}
 */
const APART = [
  {
    xpath: '//(xsl:variable | *)',
    why: 'a bare wildcard arm beside a named one',
  },
  {
    xpath: '//(xsl:variable | xsl:sequence | xsl:*[@as])',
    why: 'a wildcard arm carrying a predicate of its own',
  },
  {
    xpath: '//(xsl:variable | *)[@select]',
    why: 'a tail the arms have to carry apiece',
  },
  {
    xpath: kinds.xpath['modern-construct-in-xslt-1'].xpath,
    why: 'nine named arms, a wildcard, and an anchor over all ten',
  },
  {
    xpath: '//(xsl:template[not(contains(@match, ")"))] | xsl:variable)',
    why: 'a bracket inside a literal an arm quotes with a double quote',
  },
  {
    xpath: '//(xsl:variable[not(contains(@name, \'(\'))] | xsl:template)',
    why: 'a bracket inside a literal an arm quotes with a single quote',
  },
]

/**
 * Unions the sweep must not part, each beside the arm that stops it.
 * @type {Array.<{xpath: string, why: string}>}
 */
const UNPARTED = [
  {
    xpath: '//(xsl:variable | @name)',
    why: 'an arm selecting an attribute, where a spread admits a step alone',
  },
  {
    xpath: '//(xsl:variable | text())',
    why: 'an arm selecting a text node',
  },
  {
    xpath: '//(xsl:variable | a/b)',
    why: 'an arm of two steps, the tail distributing over the second',
  },
  {
    xpath: '//(xsl:template[@match]/xsl:param | xsl:variable)',
    why: 'an arm with a step behind its predicate',
  },
  {
    xpath: '//(xsl:variable[@as] | xsl:template)/@name',
    why: 'an arm served with an attribute beside a refused arm carrying none',
  },
]

/**
 * Unions no outer predicate may be distributed over, each beside the arm
 * that stops it.
 * @type {Array.<{xpath: string, why: string}>}
 */
const UNSPILLED = AXES.unspilled

/**
 * The two tables above, each beside the document its rows are asked over and
 * the verb for what the split must not do to them. Both halves are asserted of
 * every row — that no branch is served, and that the answer is the engine's
 * all the same — so a guard removed is caught whether or not what it admits
 * happens to answer wrongly on the document it is asked over.
 * @type {Array.<{rows: Array.<object>, sheet: Document, verb: string}>}
 */
const WITHHELD = [
  {rows: UNPARTED, sheet: APARTING, verb: 'part'},
  {rows: UNSPILLED, sheet: DISTRIBUTING, verb: 'spill'},
]

/**
 * Tails whose bracket joins clauses with `and`, each with how many of them the
 * walk answers and what is left for the engine. A clause outside the
 * vocabulary refused the whole bracket until #811, so a conjunction cost a
 * fontoxpath call on every candidate its cheapest would have refused; one
 * nothing answers is kept whole, as is one whose clause picks a position.
 * @type {Array.<{tail: string, served: number, asked: string}>}
 */
const CLAUSED = yaml.parsedFromFile(
  path.resolve(__dirname, 'resources', 'selectors', 'clauses.yaml'),
)

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
 * Where each node of a selection stands, or an error where the engine refuses
 * to answer at all — `[not(a/count(.))]` asks the effective boolean value of
 * two numbers, FORG0006 whichever way it is put. Both sides are read the same
 * way, so a raise on one side alone is a disagreement like any other. A place
 * and never a name, an attribute answering no `getAttribute` at all.
 * @param {function(): Array.<Node>} selection - What to ask for
 * @return {Array.<string>} - Where each node it answers stands, in order
 */
const standing = function(selection) {
  let where
  try {
    where = placed(selection())
  } catch (refusal) {
    where = ['error', refusal.message.slice(0, 8)]
  }
  return where
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
            refused: '',
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
            refused: '',
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
            anchor: '', tail: '', refused: '',
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
          refused: '',
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
          refused: '',
        })),
        `the union ${one.xpath} is not parted into the branches an index ` +
          'serves one at a time, so both halves go to the engine as one ' +
          'descendant sweep apiece',
      )
    })
  })
  DISTRIBUTED.forEach((one) => {
    it(`distributes the outer predicate of ${one} over its arms`, function() {
      assert.equal(
        splitOf(one).length,
        2,
        `the union ${one} wears one predicate outside its brackets and is ` +
          'not parted into the two arms that predicate distributes over, so ' +
          'both halves go to the engine as one sweep over every node there is',
      )
    })
  })
  DISTRIBUTED.forEach((one) => {
    it(`serves ${one} as the engine answers it`, function() {
      assert.deepStrictEqual(
        placed(chosen(DISTRIBUTING, one)),
        placed(nodes(DISTRIBUTING, one)),
        `the nodes served for the distributed union ${one} are not the ` +
          'nodes the engine chooses in the order it chooses them, so a ' +
          'predicate standing outside the brackets is being dropped from an ' +
          'arm, or the arms are merged on a rank the walk keeps for elements',
      )
    })
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
          'node standing in two branches or two arms is reported twice',
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
  CANDIDATES.map((one) => `${AXIS}[${one}]`).concat(
    HEADED.map((one) => `${one.head}[${one.predicate}]`),
  ).forEach((xpath) => {
    it(`answers ${xpath} as the engine reads it, or serves it not at all`,
      function() {
        assert.deepStrictEqual(
          standing(() => chosen(SHEET, xpath)),
          standing(() => nodes(SHEET, xpath)),
          `serving ${xpath} from an axis answers something else than the ` +
            'engine answers of the whole selector, so the predicate reads ' +
            'the sequence it stands in and cannot be asked of one candidate',
        )
      })
  })
  it('holds a name no UTF-16 length counts as XPath counts it', function() {
    assert.ok(
      Array.from(SHEET.documentElement.getElementsByTagNameNS(XSLT, 'variable'))
        .map((node) => node.getAttribute('name'))
        .some((name) => Array.from(name).length !== name.length),
      'no name in candidates.xsl stands outside the Basic Multilingual ' +
        'Plane, so every string the vocabulary measures is one whose code ' +
        'units are its characters and the rows asking a length of one prove ' +
        'nothing about the length XPath means',
    )
  })
  APART.forEach((one) => {
    it(`serves ${one.xpath} by the arms that name a bucket`, function() {
      assert.ok(
        splitOf(one.xpath).length > 1,
        `serving ${one.xpath} is refused though ${one.why}, so the arms a ` +
          'walk already holds are swept for the sake of the one arm it does ' +
          'not, which is the whole selector paying for its widest branch',
      )
    })
  })
  APART.forEach((one) => {
    it(`answers ${one.xpath} as the engine answers it`, function() {
      assert.deepStrictEqual(
        placed(chosen(APARTING, one.xpath)),
        placed(nodes(APARTING, one.xpath)),
        `serving ${one.xpath} apart answers other nodes than the engine ` +
          'answers of it, or answers them in another order, where a union is ' +
          'a set in document order and a node standing in two arms is one node',
      )
    })
  })
  WITHHELD.forEach((table) => {
    table.rows.forEach((one) => {
      it(`refuses to ${table.verb} ${one.xpath}, it holding ${one.why}`,
        function() {
          assert.deepStrictEqual(
            splitOf(one.xpath),
            [],
            `the split ${table.verb}s ${one.xpath} over ${one.why}, so an ` +
              'arm comes back as something the walk keeps no rank for, or ' +
              'an arm the selector asked for comes back not at all',
          )
        })
    })
  })
  WITHHELD.forEach((table) => {
    table.rows.forEach((one) => {
      it(`answers ${one.xpath} whole, as the engine answers it`, function() {
        assert.deepStrictEqual(
          placed(chosen(table.sheet, one.xpath)),
          placed(nodes(table.sheet, one.xpath)),
          `${one.xpath} answers other nodes than the engine answers of it, ` +
            'or answers them in another order, so a union the walk cannot ' +
            `promise every arm of is ${table.verb}ed all the same`,
        )
      })
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
  CLAUSED.forEach((one) => {
    it(`parts ${one.tail} into the clauses the walk answers`, function() {
      const parted = answered(one.tail)
      assert.deepStrictEqual(
        {served: parted.served.length, asked: parted.asked},
        {served: one.served, asked: one.asked},
        `the tail ${one.tail} is not parted clause by clause, so a bracket ` +
          'holding one the vocabulary answers costs a fontoxpath call on ' +
          'every candidate the rest of that bracket would have refused',
      )
    })
  })
  it('states the width of the oracle, where the note states it', function() {
    assert.deepStrictEqual(
      [...worded(WIDE.note).matchAll(WIDE.claim)].map((each) => each[1]),
      [String(CANDIDATES.length + HEADED.length)],
      'the note states an oracle other than the one this file sweeps, so a ' +
        'paragraph promising a question per spelling is read as a limit ' +
        'that has stopped being one',
    )
  })
})
