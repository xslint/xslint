/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, xml, yaml} = require('../src/helpers')
const {GAP, GAPS, tokenized} = require('../src/tokens')
const {splitOf} = require('../src/selectors')
const {REFERENCES} = require('../src/linters/corpus-linter')
const {kinds} = require('../src/resources/checks.json')
const {PRESETS} = require('../src/xslint')
const {DECIMAL, XSLT} = require('../src/xsl-version')
const {walked} = require('../src/tree')
const {authored, rendered, PLACE} = require('../scripts/generate-checks')
const {DOCUMENTS, NEARBY, worded} = require('./guides')
const {Linter} = require('eslint')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

/**
 * The xpath selectors no shared walk can serve, each beside the shape that
 * keeps it out. An axis of named elements comes off one walk and only the
 * predicate reaches the engine, where any other shape costs the traversal
 * fontoxpath performs quadratically (#635, #784, #811). A ratchet both ways: a
 * refusal names its reason, one that became servable turns red.
 * @type {{[name: string]: string}}
 */
const UNINDEXED = {
  'missing-id-in-stylesheet': 'the root itself, not a descendant sweep',
  'missing-version-in-stylesheet':
    'a root arm beside a servable one, and a union is served whole or not at all',
  'stylesheet-has-no-templates': 'the root itself, not a descendant sweep',
  'too-many-templates': 'the root itself, not a descendant sweep',
}

/**
 * Whether a shared walk can serve a selector, a branch's axis being elements
 * out of a bucket or attributes off the same walk — either an axis the run has
 * already paid for, where any other shape costs fontoxpath a descendant
 * traversal of its own. A union of whole paths is served whole or not at all;
 * one inside a sweep is parted arm by arm (#635, #784, #811).
 * @param {string} xpath - The selector a declarative check is written in
 * @return {boolean} - Whether the axis comes off the walk
 */
const serves = function(xpath) {
  return splitOf(xpath).length > 0
}

/**
 * Directory holding the check definitions.
 * @type {string}
 */
const CHECKS = path.resolve(__dirname, '..', 'src', 'resources', 'checks')

/**
 * Directory holding the check rationales.
 * @type {string}
 */
const MOTIVES = path.resolve(__dirname, '..', 'src', 'resources', 'motives')

/**
 * Directory holding the test packs.
 * @type {string}
 */
const RESOURCES = path.resolve(__dirname, 'resources')

/**
 * Every kind of check.
 * @type {Array.<string>}
 */
const KINDS = ['xpath', 'corpus', 'validation', 'format']

/**
 * Rule kinds paired with the one directory holding their packs. The code-driven
 * kinds are enforced separately: a format check's packs are scattered across
 * the per-linter directories (so it is matched by `pack:` name across them),
 * and a validation check is tested by a bespoke harness (so it is matched by
 * its name appearing in a test file).
 * @type {{[kind: string]: string}}
 */
const PACKED = {xpath: 'xpath-packs', corpus: 'corpus-packs'}

/**
 * Rule kinds paired with the YAML keys holding their selectors, so a check's
 * own XPath is audited wherever it is written.
 * @type {{[kind: string]: Array.<string>}}
 */
const SELECTORS = {xpath: ['xpath'], corpus: ['declaration', 'usage']}

/**
 * Kebab-case with no leading or trailing hyphen.
 * @type {RegExp}
 */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * A `count(...)` call compared with zero — the existence test spelled the slow
 * way, which `count-compared-to-zero` flags in a user's stylesheet and a
 * check's own selector must therefore not commit. The gap before the `(` is
 * part of the call, XPath reading an NCName as a FunctionName after
 * intervening whitespace, so `count (x) > 0` is the same test (#621).
 * @type {RegExp}
 */
const COUNTED = new RegExp(
  `count${GAP}*\\((?:[^()]|\\([^()]*\\))*\\)${GAP}*(?:!?=|[<>]=?)${GAP}*0(?!\\d)`,
)

/**
 * A `name()` call, which answers the *lexical* QName a document spells a node
 * with and so reads the prefix rather than the namespace. Three selectors
 * asked `name() = 'xsl:variable'`, blind to every stylesheet binding XSLT
 * elsewhere and cheaper nowhere (#784). `local-name()` is not banned beside
 * it: it reads no prefix, and a negated set has no node-test form at all.
 * @type {RegExp}
 */
const NAMED = new RegExp(`(^|[^-\\w])name${GAP}*\\(${GAP}*\\)`)

/**
 * A `count(*)` call, which counts the *element* children of a node and sees no
 * text among them. A selector spelling `count(*) = 1` means nothing but that
 * one instruction, and text beside it answers that as much as a second element
 * does — two of the three were false positives on real stylesheets (#491,
 * #492). So `not(text()[xslint:normalize-space(.)])` stands beside the count.
 * @type {RegExp}
 */
const CHILDREN = new RegExp(`count${GAP}*\\(${GAP}*\\*${GAP}*\\)`)

/**
 * A `text()` step, the other half of what a node holds — see `CHILDREN`.
 * @type {RegExp}
 */
const TEXTED = new RegExp(`text${GAP}*\\(${GAP}*\\)`)

/**
 * The checks that count the elements a node holds for a reason its text does
 * not disturb, each beside the shape that exempts it. `CHILDREN` asks the rest
 * to weigh both. The one entry is there for what its advice writes rather than
 * what its selector reads: an attribute value template carries the literal
 * text along beside the expression and so loses nothing.
 * @type {{[key: string]: string}}
 */
const COUNTING = {
  'not-creating-attribute-correctly':
    'an attribute value template carries the text beside the expression',
}

/**
 * An `xml:space` attribute, the only thing deciding whether a whitespace-only
 * text node is there at all: XSLT strips one before a processor looks, so
 * indentation is not content — unless the nearest ancestor declaring it says
 * `preserve`, a nearer `default` cancelling one above. Four selectors read
 * `text()` without it and all four were wrong (#817, #593).
 * @type {RegExp}
 */
const PRESERVED = new RegExp(`@xml:space`)

/**
 * The checks reading `text()` for something other than whether a node holds
 * content, beside the reason `PRESERVED` does not reach each. The one entry
 * asks what a processor **emits**: under `preserve` every indentation run is
 * emitted text, so its answer changes too — but so does the advice, `xsl:text`
 * around each run counselling nothing where the sheet never meant to preserve.
 * @type {{[key: string]: string}}
 */
const EMITTED = {
  'text-outside-xsl-text':
    'it asks what a processor emits, not whether a node holds content',
}

/**
 * An attribute a selector tests the presence of, asked either way round: the
 * `not(@x)` of #849, and the bare `@x` standing as a clause of its own, which
 * closes on a bracket, an `and`, an `or` or a union bar. A step tail is not
 * one — the `/@x` of a path reads a value where a clause asks who wrote it,
 * which is the whole of the difference this gate turns on (#851).
 * @type {RegExp}
 */
const SUPPLIED = new RegExp(
  `(^|[^/])@([\\w:.-]+)${GAP}*(?:\\)${GAP}*)*(?:\\]|and\\b|or\\b|\\|)`, 'g',
)

/**
 * The shadow spelling of an attribute, the underscore standing in front of the
 * local name and never in front of the prefix: `_xsl:version` names a prefix
 * no document binds, where `xsl:_version` is the one XSLT means.
 * @param {string} named - The attribute as a selector spells it
 * @return {string} - The same attribute written in shadow form
 */
const shadowed = function(named) {
  return named.replace(/[^:]+$/, (local) => `_${local}`)
}

/**
 * The attributes with no shadow spelling to ask after, beside the reason. The
 * mechanism reaches an attribute of an XSLT element in no namespace, so
 * `xml:space` has none at all; `xsl:version` is what makes a literal result
 * element a stylesheet, so nothing is running yet to read one — Saxon refuses
 * `xsl:_version` (XTSE0150) and `_xsl:version` (SXXP0003) alike on such a root.
 * @type {{[key: string]: string}}
 */
const SHADOWLESS = {
  'xml:space': 'the shadow mechanism reaches no attribute in a namespace',
  'xsl:version': 'it is what makes a literal result element a stylesheet',
}

/**
 * Every attribute a selector tests the presence of in one spelling alone.
 * @param {string} selector - The XPath a declarative check is written in
 * @return {Array.<string>} - The attributes it asks about one way only
 */
const unshadowed = function(selector) {
  return Array.from(selector.matchAll(SUPPLIED))
    .map((found) => found[2])
    .filter((named) => !named.split(':').pop().startsWith('_'))
    .filter((named) => !selector.includes(`@${shadowed(named)}`))
}

/**
 * A version attribute as a selector reads one, in both spellings XSLT gives it
 * and the shadow form each wears. A gate over the version *in force* asks
 * `xslint:version` instead, that being an answer no selector reaches: XSLT
 * sets a version on any element, so one read off the root misjudges every
 * subtree raised or lowered against it (#618, #851).
 * @type {RegExp}
 */
const DECLARED = /@(?:xsl:)?_?version\b/

/**
 * The checks whose subject *is* the version attribute, beside what each reads
 * it for. Nothing else may read one: four gates asked the root, two of them
 * against a list of spellings where a floor was meant (#851). A ratchet both
 * ways, `DECLARED` failing an unlisted reader and this table an entry that has
 * stopped reading one.
 * @type {{[name: string]: string}}
 */
const VERSIONED = {
  'malformed-version-in-stylesheet': 'the attribute is what it reports on',
  'missing-version-in-stylesheet': 'the attribute is what it reports missing',
}

/**
 * The function a declarative gate asks the version in force at a node with,
 * answering `NaN` where nothing declares one, so no floor is cleared (#851).
 * @type {string}
 */
const FLOOR = 'xslint:version'

/**
 * Whether a selector asks the version in force under a `not()`. There a `NaN`
 * fails the comparison and the negation turns that into true, so a version
 * nobody declared is judged as 1.0 rather than left unjudged — how
 * `empty-variable` reported a typed variable in an unversioned sheet (#1062).
 * @param {string} xpath - The selector a declarative check is written in
 * @return {boolean} - True when a version is compared inside a negation
 */
const inverts = function(xpath) {
  const open = []
  let found = false
  let previous = ''
  for (const token of tokenized(xpath)
    .filter((one) => one.type !== 'whitespace')) {
    if (token.type === '(' || token.type === '[') {
      open.push(token.type === '(' && previous === 'not')
    }
    if (token.type === ')' || token.type === ']') {
      open.pop()
    }
    if (token.value === FLOOR && open.includes(true)) {
      found = true
    }
    previous = token.value
  }
  return found
}

/**
 * Whether a fixture declares no version at its root, in any spelling XSLT
 * gives the attribute, so the version in force anywhere in it is `NaN`.
 * @param {Document} xsl - The parsed fixture
 * @return {boolean} - True when the root declares no version
 */
const unversioned = function(xsl) {
  return Array.from(xsl.documentElement.attributes)
    .every((attribute) => !/^_?version$/.test(attribute.localName))
}

/**
 * Each exemption table beside the question deciding whether its entries are
 * still needed, so one gate holds every table from the far side.
 * @type {Array.<{table: object, still: function(string): boolean}>}
 */
const EXEMPTED = [
  {table: COUNTING, still: (sel) => CHILDREN.test(sel) && !TEXTED.test(sel)},
  {table: EMITTED, still: (sel) => TEXTED.test(sel) && !PRESERVED.test(sel)},
  {table: VERSIONED, still: (sel) => DECLARED.test(sel)},
]

/**
 * A string literal a selector compares an expression's *text* against, which
 * is a literal whose own content is quoted: "'true'" asks whether a `@test`
 * reads `'true'` character for character. XPath spells one string with either
 * delimiter, so a selector naming one spelling reads half the stylesheets it
 * is about (#549). The twin must stand beside it.
 * @type {RegExp}
 */
const SPELLED = /"'([^']*)'"|'"([^"]*)"'/g

/**
 * The `require` of `test/helpers.js`, whose every export starts a child process
 * — xslint or xcop run as a user would run it. Nothing else in the suite spawns
 * one, so this single line is what separates a deep test from a fast one. Its
 * escapes also keep the pattern from matching the file it is written in.
 * @type {RegExp}
 */
const SPAWNS = /require\('\.\/helpers'\)/

/**
 * Suffix a deep test file wears, so the fast half of the suite can be run by
 * glob rather than by a list somebody has to remember to extend.
 * @type {string}
 */
const DEEP = '.deep.test.js'

/**
 * Whether the line cap reports a file. The rule itself is asked, rather than
 * the lines counted a second time here, so the guard cannot come to measure
 * something other than what ESLint measures; a file that is gone answers no,
 * since an exemption naming nothing is as stale as one naming a short file.
 * @param {string} named - Path of the file from the repository root
 * @param {Array} rule - The max-lines rule as eslint.config.mjs sets it
 * @return {boolean} - TRUE when the rule reports the file
 */
const sprawls = function(named, rule) {
  const whole = path.resolve(__dirname, '..', named)
  let found = []
  if (fs.existsSync(whole)) {
    found = new Linter().verify(
      fs.readFileSync(whole, 'utf-8'),
      {rules: {'max-lines': rule}},
    )
  }
  return found.some((one) => one.ruleId === 'max-lines')
}

/**
 * A length as a document spells it, the gap being XML's four characters and
 * never JavaScript's \s.
 * @type {RegExp}
 */
const LINED = new RegExp(`([0-9][0-9,]*)${GAP}+lines`)

/**
 * Every length a document states of a file: the file's own name in backticks,
 * and a count of lines standing within `NEARBY` characters of it. The name is
 * split on rather than matched, a path carrying a `.` and a `/` that a
 * pattern would have to escape.
 * @param {string} named - Path of the file from the repository root
 * @return {Array.<number>} - Every length a document states of it
 */
const stated = function(named) {
  return DOCUMENTS
    .flatMap((file) => worded(file).split(`\`${named}\``).slice(1))
    .map((after) => after.slice(0, NEARBY).match(LINED))
    .filter((claim) => claim)
    .map((claim) => Number(claim[1].replaceAll(',', '')))
}

/**
 * Whether a file stands at exactly this many lines, asked as the cap twice:
 * the rule stays quiet at that length and reports the file one line under it.
 * So the count is ESLint's own, in the unit the cap is written in — the blank
 * lines and the comments among them — rather than a second reading taken here,
 * which would argue with the rule about the newline a file ends with.
 * @param {string} named - Path of the file from the repository root
 * @param {Array} cap - The max-lines rule as eslint.config.mjs sets it
 * @param {number} length - The length a document states of it
 * @return {boolean} - TRUE when the file stands at that length
 */
const measures = function(named, cap, length) {
  return !sprawls(named, [cap[0], {...cap[1], max: length}]) &&
    sprawls(named, [cap[0], {...cap[1], max: length - 1}])
}

/**
 * Names of the checks of a kind.
 * @param {string} kind - Kind of check
 * @return {Array.<string>} - Check names
 */
const names = function(kind) {
  return allFilesFrom(path.join(CHECKS, kind))
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => path.basename(file, '.yaml'))
}

/**
 * Keys a check may no longer carry, each beside what it stood for: a flag
 * claiming a check finished (#865), and a mark the tree was to add by hand the
 * day an issue reported one wrong, which no gate could hold it to (#1070).
 * @type {Array.<Array.<string>>}
 */
const RETIRED = [
  ['mature', 'maturity flag'],
  ['nursery', 'nursery mark'],
]

/**
 * The most reports the recommended preset may draw over each corpus: the
 * geometric middle of what it draws and what it would draw holding
 * `unused-variable` again, the check moved out for its volume, so a noisy
 * check joining it turns this red (#1094).
 * @type {{[corpus: string]: number}}
 */
const QUIET = {docbook: 215, tei: 108, ditaot: 18}

/**
 * How far under its bar a reading may stand before the bar has stopped being
 * one and wants retightening, as every ratchet in the suite reads it.
 * @type {number}
 */
const SLACK = 4

/**
 * What the recommended preset draws over a corpus, read off the report the
 * nightly job diffs that corpus against.
 * @param {string} corpus - Name of the corpus
 * @return {number} - How many of its reports a recommended check made
 */
const recommended = function(corpus) {
  return fs.readFileSync(path.join(RESOURCES, 'corpora', `${corpus}.txt`), 'utf-8')
    .split('\n')
    .filter((line) => PRESETS.recommended.includes(line.split(' ')[1]))
    .length
}

/**
 * Whether the document is XSLT at all: an element in the XSLT namespace, or an
 * attribute in it, which is the whole of what a simplified stylesheet has. A
 * pack whose fixture holds neither is a fixture no check can see a node of, so
 * every amount it claims passes and a selector rewritten to fire on everything
 * passes with it — three spelled it `https://` (#698).
 * @param {Document} xsl - The parsed fixture
 * @return {boolean} - True when something in it is XSLT's
 */
const stylish = function(xsl) {
  return Array.from(xsl.getElementsByTagName('*'))
    .concat(walked(xsl))
    .some((node) => node.namespaceURI === XSLT)
}

/**
 * What a pack expects of a run — the keys a harness walks to assert it. Only
 * `test/packs.js` may read them, so that an assertion the packs carry is
 * written once rather than once per linter (#660).
 * @type {RegExp}
 */
const EXPECTS = /found\.(amount|positions|fixes|values)/

/**
 * The pack directory a harness call names. One call per directory and one
 * directory per call, which is what stands between a pack directory and going
 * unread: the harness is one function, so deleting the call that hands it a
 * directory deletes every assertion over those packs at once. Eleven of the
 * twenty-two could be dropped with coverage still at 100% (#660).
 * @type {RegExp}
 */
const READS = /dir: '([\w-]+-packs)'/g

/**
 * The most words a check's message may run to. Past it a message carries the
 * derivation, which is the motive's job, and fills a terminal line four times
 * over where the README quotes it (#1072).
 * @type {number}
 */
const WORDS = 30

/**
 * The most words a motive spends outside its code blocks and its headings.
 * Past it the motive carries the derivation, which serves whoever maintains
 * the check and belongs to the ticket that derived it (#1176).
 * @type {number}
 */
const PROSE = 100

/**
 * The words a motive spends on prose, its fenced blocks and headings left out.
 * @param {string} motive - The markdown of a motive
 * @return {number} - How many words the reader reads beside the examples
 */
const spent = function(motive) {
  return motive.replace(/```[^]*?```/g, ' ').split('\n')
    .filter((line) => !line.startsWith('#')).join(' ')
    .split(GAPS).filter((word) => word.length > 0).length
}

/**
 * Where one sentence of a message ends and the next opens: a stop, a gap, and
 * a capital. A `.` standing alone as the context item, or inside `2.0` or a
 * `(...)`, ends nothing, since no capital follows it.
 * @type {RegExp}
 */
const STOP = /[.?!] (?=[A-Z])/g

/**
 * The shape of every check's message, each departure beside the question that
 * finds it: two sentences, the fault and then the remedy, a period at the end,
 * names bare rather than quoted, no dash, and no more than `WORDS` (#1072).
 * @type {{[departure: string]: function(string): boolean}}
 */
const SHAPED = {
  'is not two sentences': (message) => (message.match(STOP) ?? []).length !== 1,
  'does not end with a period': (message) => !message.endsWith('.'),
  'quotes a name': (message) => /'(xsl:|@)/.test(message),
  'holds a dash': (message) => /[–—]| - /.test(message),
  [`runs past ${WORDS} words`]: (message) => message.split(' ').length > WORDS,
}

/**
 * The keys a check words a message under: `message` on every check, and
 * `namespace` on `malformed-stylesheet`, what a prefix nothing binds earns in
 * place of a syntax fault (#1019).
 * @type {Array.<string>}
 */
const WORDINGS = ['message', 'namespace']

/**
 * Every way one message departs from `SHAPED`.
 * @param {string} message - What a check tells the user
 * @return {Array.<string>} - The departures, none for a message in shape
 */
const departures = function(message) {
  return Object.keys(SHAPED).filter((departure) => SHAPED[departure](message))
}

describe('conformance', function() {
  it('keeps the generated checks abreast of the YAML that authors them', function() {
    assert.equal(
      fs.readFileSync(PLACE.to, 'utf-8'), rendered(authored()),
      [
        `${path.basename(PLACE.to)} is not what the YAML under`,
        `${path.basename(PLACE.from)}/ says any more, and it is what a run`,
        'reads, so the check you edited is not the check that fires; run',
        '`npx grunt checks`',
      ].join(' '),
    )
  })
  it('names every check in kebab-case without the banned prefix', function() {
    for (const kind of KINDS) {
      for (const name of names(kind)) {
        assert.ok(KEBAB.test(name), `${kind}/${name} is not kebab-case`)
        assert.ok(
          !name.startsWith('template-match-'),
          `${kind}/${name} carries the banned 'template-match-' prefix`,
        )
      }
    }
  })
  it('gives every check a motive', function() {
    for (const kind of KINDS) {
      for (const name of names(kind)) {
        assert.ok(
          fs.existsSync(path.join(MOTIVES, kind, `${name}.md`)),
          `${kind}/${name} has no motive`,
        )
      }
    }
  })
  RETIRED.forEach(([key, what]) => {
    it(`carries no ${what} on a check of any kind`, function() {
      assert.deepStrictEqual(
        KINDS.flatMap((kind) => names(kind)
          .filter((name) => Object.hasOwn(
            yaml.parsedFromFile(path.join(CHECKS, kind, `${name}.yaml`)), key,
          ))
          .map((name) => `${kind}/${name}`)),
        [],
        `a check cannot carry the retired ${key} key, ${what} being gone`,
      )
    })
  })
  it('places every check in a preset a run may start from', function() {
    assert.deepStrictEqual(
      KINDS.flatMap((kind) => Object.entries(kinds[kind])
        .filter(([, check]) => !Object.hasOwn(PRESETS, check.preset))
        .map(([name]) => `${kind}/${name}`)),
      [],
      [
        'a check names no preset a run may start from, so whether a run',
        'reports it by default was decided by nobody (#1094)',
      ].join(' '),
    )
  })
  it('recommends every check a processor refuses the stylesheet over', function() {
    assert.deepStrictEqual(
      KINDS.flatMap((kind) => Object.entries(kinds[kind])
        .filter(([, check]) => check.severity === 'error')
        .filter(([, check]) => check.preset !== 'recommended')
        .map(([name]) => `${kind}/${name}`)),
      [],
      [
        'a check graded an error stays out of the recommended preset, so a',
        'default run keeps quiet about a stylesheet no processor loads',
      ].join(' '),
    )
  })
  Object.entries(QUIET).forEach(([corpus, bar]) => {
    it(`keeps the recommended preset quiet over ${corpus}`, function() {
      assert.ok(
        recommended(corpus) <= bar && recommended(corpus) * SLACK > bar,
        [
          `the recommended preset draws ${recommended(corpus)} reports over`,
          `${corpus} against a bar of ${bar}: past it a noisy check joined`,
          'the preset, and far enough under it the bar wants retightening',
        ].join(' '),
      )
    })
  })
  it('words every message as a fault and then its remedy', function() {
    const found = {}
    for (const kind of KINDS) {
      for (const [name, check] of Object.entries(kinds[kind])) {
        const departed = WORDINGS
          .filter((key) => Object.hasOwn(check, key))
          .flatMap((key) => departures(check[key])
            .map((departure) => `${key} ${departure}`))
        if (departed.length > 0) {
          found[`${kind}/${name}`] = departed
        }
      }
    }
    assert.deepStrictEqual(
      found, {},
      [
        'a check message departs from the one shape every message takes:',
        'the fault, then the remedy, a period at the end, names bare, no',
        `dash, and no more than ${WORDS} words, the derivation being the`,
        'motive\'s to carry (#1072)',
      ].join(' '),
    )
  })
  for (const [message, departure] of [
    ['A dot . stands for itself in 2.0 and later. Keep it.', undefined],
    ['An xsl:if is empty. Fill it. Or drop it.', 'is not two sentences'],
    ['An xsl:if is empty, so fill it or drop it.', 'is not two sentences'],
    ['An xsl:if is empty. Fill it', 'does not end with a period'],
    ['An \'xsl:if\' is empty. Fill it.', 'quotes a name'],
    ['The \'@test\' is missing. Add it.', 'quotes a name'],
    ['An xsl:if is empty — always. Fill it.', 'holds a dash'],
    ['An xsl:if is empty - always. Fill it.', 'holds a dash'],
    [`An xsl:if is${' very'.repeat(25)} empty. Fill it.`, `runs past ${WORDS} words`],
  ]) {
    it(`finds ${departure ?? 'nothing'} in "${message.slice(0, 40)}"`, function() {
      assert.deepStrictEqual(
        departures(message), [departure].filter(Boolean),
        `the message gate does not read "${message}" as it should`,
      )
    })
  }
  it(`holds every motive to ${PROSE} words of prose`, function() {
    assert.deepStrictEqual(
      KINDS.flatMap((kind) => allFilesFrom(path.join(MOTIVES, kind))
        .filter((motive) => spent(fs.readFileSync(motive, 'utf-8')) > PROSE)
        .map((motive) => `${kind}/${path.basename(motive, '.md')}`)),
      [],
      [
        `a motive spends more than ${PROSE} words outside its code blocks, so`,
        'it carries a derivation that belongs to the ticket it came from (#1176)',
      ].join(' '),
    )
  })
  for (const [motive, words] of [
    ['# Heading words\n\nTwo words.', 2],
    ['One.\n\n```text\nselect a b c\n```\n\nTwo here.', 3],
    ['A\tgap  and\nlines.\n\n```\nx\n```\n```\ny z\n```', 4],
  ]) {
    it(`counts ${words} words of prose in "${motive.slice(0, 20)}"`, function() {
      assert.equal(
        spent(motive), words,
        `the motive gate does not count the prose of "${motive}" as it should`,
      )
    })
  }
  it('gives every rule check at least one test pack', function() {
    for (const [kind, dir] of Object.entries(PACKED)) {
      const packed = new Set(
        allFilesFrom(path.join(RESOURCES, dir))
          .filter((file) => file.endsWith('.yaml'))
          .map((file) => yaml.parsedFromFile(file).pack),
      )
      for (const name of names(kind)) {
        assert.ok(packed.has(name), `${kind}/${name} has no test pack`)
      }
    }
  })
  it('gives every format check a test pack somewhere', function() {
    const packed = new Set(
      allFilesFrom(RESOURCES)
        .filter((file) => file.endsWith('.yaml'))
        .map((file) => yaml.parsedFromFile(file).pack),
    )
    for (const name of names('format')) {
      assert.ok(packed.has(name), `format/${name} has no test pack`)
    }
  })
  it('pins every defect a pack expects to a position', function() {
    assert.deepEqual(
      allFilesFrom(RESOURCES)
        .filter((file) => file.endsWith('.yaml'))
        .map((file) => ({
          name: path.relative(RESOURCES, file), yml: yaml.parsedFromFile(file),
        }))
        .filter((pack) => pack.yml.found)
        .filter((pack) =>
          (pack.yml.found.positions ?? []).length !== pack.yml.found.amount)
        .map((pack) => pack.name),
      [],
      [
        'a pack expecting more defects than it gives positions for asserts',
        'nothing about where they stand, since every harness walks the',
        'positions rather than the count',
      ].join(' '),
    )
  })
  it('pins the fix of every format pack against its positions', function() {
    const formats = new Set(names('format'))
    const packs = allFilesFrom(RESOURCES)
      .filter((file) => file.endsWith('.yaml'))
      .map((file) => ({
        name: path.relative(RESOURCES, file), yml: yaml.parsedFromFile(file),
      }))
      .filter((pack) => formats.has(pack.yml.pack))
    assert.deepEqual(
      packs
        .filter((pack) => !Array.isArray(pack.yml.found.fixes) ||
          pack.yml.found.fixes.length !== pack.yml.found.positions.length)
        .map((pack) => pack.name),
      [],
      'a format pack whose fixes do not stand one per position asserts nothing about them',
    )
  })
  it('hands every pack directory to the harness exactly once', function() {
    assert.deepEqual(
      allFilesFrom(__dirname)
        .filter((file) => file.endsWith('.test.js'))
        .flatMap((file) => [...fs.readFileSync(file, 'utf-8').matchAll(READS)]
          .map((match) => match[1]))
        .sort(),
      [...new Set(
        allFilesFrom(RESOURCES)
          .filter((file) => file.endsWith('.yaml'))
          .map((file) => path.basename(path.dirname(file)))
          .filter((dir) => dir.endsWith('-packs')),
      )].sort(),
      [
        'a pack directory no harness call names goes unread, and every',
        'assertion over its packs goes with it, which nothing else here can',
        'notice: the harness being one function, the call handing it a',
        'directory is the whole of what runs that directory. Deleting the',
        'call for xpath-packs took all thirty-eight declarative checks out',
        'of the suite and left eslint, npm test and a 100% coverage run',
        'green (#660). A name matched twice is the same hole the other way,',
        'a directory read under one call and a second name spelled for',
        'nothing',
      ].join(' '),
    )
  })
  it('reads what a pack expects in the one harness and nowhere else',
    function() {
      assert.deepEqual(
        allFilesFrom(__dirname)
          .filter((file) => file.endsWith('.test.js'))
          .filter((file) => file !== __filename)
          .filter((file) => EXPECTS.test(fs.readFileSync(file, 'utf-8')))
          .map((file) => path.basename(file)),
        [],
        [
          'a test file reading what a pack expects is a second copy of the',
          'harness, and an assertion written into every copy but one fails',
          'nowhere: that is how import-packs came to assert no fix while',
          'redundant-import attached a real deletion (#660). Read the',
          'directory through the harness in test/packs.js, which asserts',
          'the amount, the positions, the name, the severity, the message,',
          'the fixes and the values of every pack it is given',
        ].join(' '),
      )
    })
  it('names every test file after the resources it takes', function() {
    assert.deepEqual(
      allFilesFrom(__dirname)
        .filter((file) => file.endsWith('.test.js'))
        .filter((file) => SPAWNS.test(fs.readFileSync(file, 'utf-8')) !==
          file.endsWith(DEEP))
        .map((file) => path.basename(file)),
      [],
      [
        `a test file that starts a child process is not named '${DEEP}', or one`,
        'that starts none is, so the fast half of the suite runs the wrong files',
      ].join(' '),
    )
  })
  it('writes every scratch file of a test into a temporary directory', function() {
    assert.deepEqual(
      allFilesFrom(__dirname)
        .filter((file) => file.endsWith('.test.js'))
        .filter((file) => {
          const suite = fs.readFileSync(file, 'utf-8')
          return suite.includes('writeFileSync') &&
            !suite.includes('mkdtempSync')
        })
        .map((file) => path.basename(file)),
      [],
      [
        'a test that writes a file without asking for a temporary directory',
        'leaves it in the working tree, where the run that lints the',
        'repository walks over it and loses its count (#687)',
      ].join(' '),
    )
  })
  it('caps how far a source file may grow', async function() {
    assert.ok(
      (await import('../eslint.config.mjs')).default
        .some((entry) => Array.isArray(entry.rules?.['max-lines'])),
      [
        'nothing in eslint.config.mjs caps the length of a source file, so the',
        'next one to sprawl past what a reader can hold passes lint',
      ].join(' '),
    )
  })
  it('lifts that cap off no file standing under it', async function() {
    const config = (await import('../eslint.config.mjs')).default
    const cap = config
      .map((entry) => entry.rules?.['max-lines'])
      .filter((rule) => Array.isArray(rule))
      .pop()
    assert.deepEqual(
      config
        .filter((entry) => entry.rules?.['max-lines'] === 'off')
        .flatMap((entry) => entry.files)
        .filter((named) => !sprawls(named, cap)),
      [],
      [
        'a file the line cap is switched off for stands under it now, or names',
        'nothing at all, so the exemption in eslint.config.mjs claims a',
        'length the tree no longer holds',
      ].join(' '),
    )
  })
  it('states the length of every file the cap is lifted off', async function() {
    const config = (await import('../eslint.config.mjs')).default
    const cap = config
      .map((entry) => entry.rules?.['max-lines'])
      .filter((rule) => Array.isArray(rule))
      .pop()
    assert.deepEqual(
      config
        .filter((entry) => entry.rules?.['max-lines'] === 'off')
        .flatMap((entry) => entry.files)
        .filter((named) => {
          const lengths = stated(named)
          return lengths.length === 0 ||
            lengths.some((length) => !measures(named, cap, length))
        }),
      [],
      [
        'a file the line cap is lifted off is stated at a length it does not',
        'stand at, or at no length at all, so the one number bounding a',
        'file nothing else bounds answers to nothing (#825)',
      ].join(' '),
    )
  })
  it('tests every validation check by name in a test file', function() {
    const suite = allFilesFrom(path.resolve(__dirname))
      .filter((file) => file.endsWith('.test.js'))
      .map((file) => fs.readFileSync(file, 'utf-8'))
      .join('\n')
    for (const name of names('validation')) {
      assert.ok(suite.includes(name), `validation/${name} is tested nowhere`)
    }
  })
  it('tests existence directly, never by counting, in every selector', function() {
    for (const [kind, keys] of Object.entries(SELECTORS)) {
      for (const name of names(kind)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, kind, `${name}.yaml`),
        )
        for (const key of keys) {
          assert.ok(
            !check[key] || !COUNTED.test(check[key]),
            [
              `${kind}/${name} compares count(...) with 0 in its ${key};`,
              'write the node test itself, as count-compared-to-zero asks',
            ].join(' '),
          )
        }
      }
    }
  })
  it('weighs the text a node holds wherever a selector counts its elements',
    function() {
      for (const [kind, keys] of Object.entries(SELECTORS)) {
        for (const name of names(kind)) {
          const check = yaml.parsedFromFile(
            path.join(CHECKS, kind, `${name}.yaml`),
          )
          for (const key of keys) {
            assert.ok(
              !check[key] || !CHILDREN.test(check[key]) ||
                TEXTED.test(check[key]) || COUNTING[name] !== undefined,
              [
                `${kind}/${name} counts the elements a node holds in its`,
                `${key} and asks nothing about its text, which answers the`,
                'same question: a construct holding one instruction and a',
                'string of text holds more than the instruction, and the',
                'check reports it as though it did not. Weigh the text',
                'beside the count, as not(text()[xslint:normalize-space(.)]) does',
              ].join(' '),
            )
          }
        }
      }
    })
  it('reads xml:space wherever a selector asks whether a node holds text',
    function() {
      for (const [kind, keys] of Object.entries(SELECTORS)) {
        for (const name of names(kind)) {
          const check = yaml.parsedFromFile(
            path.join(CHECKS, kind, `${name}.yaml`),
          )
          for (const key of keys) {
            assert.ok(
              !check[key] || !TEXTED.test(check[key]) ||
                PRESERVED.test(check[key]) || EMITTED[name] !== undefined,
              [
                `${kind}/${name} reads text() in its ${key} to decide whether`,
                'a node holds content and never asks about xml:space, so it',
                'reads past a whitespace-only node the nearest preserve in',
                'scope keeps. Weigh that node too, the way',
                'ancestor::*[@xml:space][1] answers it',
              ].join(' '),
            )
          }
        }
      }
    })
  it('asks both spellings of an attribute a selector tests the presence of',
    function() {
      for (const [kind, keys] of Object.entries(SELECTORS)) {
        for (const name of names(kind)) {
          const check = yaml.parsedFromFile(
            path.join(CHECKS, kind, `${name}.yaml`),
          )
          for (const key of keys) {
            assert.deepStrictEqual(
              unshadowed(check[key] ?? '').filter(
                (named) => SHADOWLESS[named] === undefined &&
                  !(key === 'declaration' && named === 'name'),
              ),
              [],
              [
                `${kind}/${name} asks its ${key} whether an attribute is`,
                'there and reads one of the two spellings XSLT gives it, so',
                'a stylesheet writing the shadow form draws a defect no',
                'processor agrees with. Ask the shadow spelling beside it',
              ].join(' '),
            )
          }
        }
      }
    })
  it('marks the local name of an attribute and never its prefix', function() {
    assert.strictEqual(
      shadowed('xsl:version'), 'xsl:_version',
      [
        'the shadow spelling of a prefixed attribute keeps the prefix and',
        'underscores the local name, where _xsl:version names a prefix no',
        'document binds and so reaches no attribute at all. Nothing else',
        'asks: both prefixed presence tests in the tree are exempt on',
        'SHADOWLESS, so the gates around this one read the same either way',
      ].join(' '),
    )
  })
  it('exempts an attribute from its shadow spelling only while it has none',
    function() {
      const asked = Object.entries(SELECTORS).flatMap(
        ([kind, keys]) => names(kind).flatMap(
          (name) => keys.map(
            (key) => yaml.parsedFromFile(
              path.join(CHECKS, kind, `${name}.yaml`),
            )[key] ?? '',
          ),
        ),
      ).flatMap(unshadowed)
      assert.deepStrictEqual(
        Object.keys(SHADOWLESS).filter((named) => !asked.includes(named)),
        [],
        [
          'an attribute in the SHADOWLESS table of test/conformance.test.js is',
          'asked about in both spellings now, or asked about by nobody, so',
          'its entry is asserting nothing: a selector that gains the guard',
          'takes its own exemption with it',
        ].join(' '),
      )
    })
  it('exempts a selector only while it still needs the exemption', function() {
    for (const {table, still} of EXEMPTED) {
      for (const name of Object.keys(table)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, 'xpath', `${name}.yaml`),
        )
        assert.ok(
          still(check.xpath),
          [
            `xpath/${name} is exempt on the grounds that ${table[name]}, and`,
            'no longer needs it: the selector either stopped spelling the',
            'shape the bar is about, or answers the bar already. Drop it',
          ].join(' '),
        )
      }
    }
  })
  it('names a node by its namespace, never by its prefix, in a selector',
    function() {
      for (const [kind, keys] of Object.entries(SELECTORS)) {
        for (const name of names(kind)) {
          const check = yaml.parsedFromFile(
            path.join(CHECKS, kind, `${name}.yaml`),
          )
          for (const key of keys) {
            assert.ok(
              !check[key] || !NAMED.test(check[key]),
              [
                `${kind}/${name} calls name() in its ${key}, which answers the`,
                'prefix a document happens to spell a node with, so the check',
                'is blind to every stylesheet binding the XSLT namespace to',
                'another one. Write a namespace-bound node test instead, such',
                'as //(xsl:variable | xsl:template); where the set is negated',
                'and no union can spell it, local-name() reads no prefix and',
                'is allowed',
              ].join(' '),
            )
          }
        }
      }
    })
  it('cannot list a check that is no longer written as a selector', function() {
    assert.deepStrictEqual(
      Object.keys(UNINDEXED).filter((name) => !names('xpath').includes(name)),
      [],
      [
        'a name in the UNINDEXED table of test/conformance.test.js is not an',
        'xpath check any more, so its entry is asserting nothing: a check that',
        'has moved to code, or been renamed, or been deleted takes its',
        'exemption with it',
      ].join(' '),
    )
  })
  it('serves every selector a cross-file check is written in', function() {
    assert.deepStrictEqual(
      names('corpus')
        .flatMap((name) => SELECTORS.corpus.map((key) => ({
          name: `${name}/${key}`,
          xpath: kinds.corpus[name][key],
        })))
        .filter((one) => one.xpath !== undefined && !serves(one.xpath))
        .map((one) => one.name),
      [],
      [
        'a cross-file selector is no longer served from the walk in',
        'src/tree.js. Both sides of such a check grow with the project and the',
        'work is their product, so a descendant traversal here is the dearest',
        'one there is: the every-attribute usage three of the four are written in cost',
        'fontoxpath 1.613 s over DocBook-XSL, 18% of the whole run, against 8',
        'ms off the walk. Unlike the per-file kind there is no table of',
        'exemptions, four selectors of one shape each being few enough that a',
        'fifth belongs in that shape too (#811)',
      ].join(' '),
    )
  })
  it('serves every xpath selector it can from the shared walk', function() {
    const drifted = names('xpath')
      .map((name) => ({
        name: name,
        served: serves(kinds.xpath[name].xpath),
        listed: Object.hasOwn(UNINDEXED, name),
      }))
      .filter((check) => check.served === check.listed)
      .map((check) => `${check.name} (served: ${check.served})`)
    assert.deepStrictEqual(
      drifted,
      [],
      [
        'a selector and the UNINDEXED table in test/conformance.test.js no',
        'longer agree. A selector that cannot be served from the walk in',
        'src/tree.js costs fontoxpath a descendant traversal of its own, which',
        'it performs quadratically over an xmldom tree, so a new one belongs',
        'in that table with the shape that puts it there — or, better, gets',
        'written as a descendant sweep of named elements. A selector listed',
        'there and served anyway has outgrown its entry, and the entry goes:',
        `${drifted.join(', ')}`,
      ].join(' '),
    )
  })
  it('names a kind of reference the corpus linter reads', function() {
    const foreign = names('corpus')
      .map((name) => ({
        name,
        reference: yaml.parsedFromFile(
          path.join(CHECKS, 'corpus', `${name}.yaml`),
        ).reference,
      }))
      .filter((check) => check.reference)
      .filter((check) => !REFERENCES.includes(check.reference))
      .map((check) => check.name)
    assert.deepStrictEqual(
      foreign, [],
      [
        `${foreign.join(', ')} names a reference that is none of`,
        `${REFERENCES.join(', ')}, the kinds the token scan in`,
        'src/linters/corpus-linter.js reads off a usage value. An index',
        'built for a word no scan answers holds no name at all, so every',
        'declaration in the corpus is reported as dead',
      ].join(' '),
    )
  })
  it('names both quotes of a literal it compares text with', function() {
    for (const [kind, keys] of Object.entries(SELECTORS)) {
      for (const name of names(kind)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, kind, `${name}.yaml`),
        )
        for (const key of keys) {
          for (const match of (check[key] ?? '').matchAll(SPELLED)) {
            const inner = match[1] ?? match[2]
            let twin = `'"${inner}"'`
            if (match[2] !== undefined) {
              twin = `"'${inner}'"`
            }
            assert.ok(
              check[key].includes(twin),
              [
                `${kind}/${name} compares its ${key} with ${match[0]} and not`,
                `with ${twin}, so a stylesheet spelling that string the other`,
                'way round goes unreported (#549)',
              ].join(' '),
            )
          }
        }
      }
    }
  })
  it('anchors a root selector on all three XSLT roots', function() {
    const roots = [
      /(?<!\/)\/xsl:stylesheet/,
      /(?<!\/)\/xsl:transform/,
      /(?<!\/)\/xsl:package/,
    ]
    for (const [kind, keys] of Object.entries(SELECTORS)) {
      for (const name of names(kind)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, kind, `${name}.yaml`),
        )
        for (const key of keys) {
          if (check[key] && roots.some((root) => root.test(check[key]))) {
            assert.ok(
              roots.every((root) => root.test(check[key])),
              [
                `${kind}/${name} anchors on one XSLT root and not on all of`,
                '/xsl:stylesheet, /xsl:transform and /xsl:package, so a module',
                'rooted at the one it leaves out goes unreported (#1017)',
              ].join(' '),
            )
          }
        }
      }
    }
  })
  it('spells the decimal a version is in one place only', function() {
    assert.ok(
      yaml.parsedFromFile(
        path.join(CHECKS, 'xpath', 'malformed-version-in-stylesheet.yaml'),
      ).xpath.includes(DECIMAL.source),
      [
        'malformed-version-in-stylesheet writes its own xs:decimal pattern rather',
        'than the DECIMAL of src/xsl-version.js, so the check and the reader',
        'it reports for can disagree on what a version is',
      ].join(' '),
    )
  })
  it('reads a version attribute only where the attribute is the subject',
    function() {
      for (const [kind, keys] of Object.entries(SELECTORS)) {
        for (const name of names(kind)) {
          const check = yaml.parsedFromFile(
            path.join(CHECKS, kind, `${name}.yaml`),
          )
          for (const key of keys) {
            assert.ok(
              !DECLARED.test(check[key] ?? '') ||
                Object.hasOwn(VERSIONED, name),
              [
                `${kind}/${name} reads a version attribute in its ${key},`,
                'where what a gate means is the version in force: XSLT sets',
                'one on any element and a shadow `_version` spells it as',
                'readily, so an answer read off the root misjudges every',
                'subtree raised or lowered against it, and a list of the',
                'spellings that clear a floor is a second opinion about',
                'XSLT. Ask xslint:version(.), which hands back what',
                'versionOf answers and NaN where nothing declares a version,',
                'clearing no floor and so leaving the report unmade. Only a',
                'check reporting on the attribute itself reads one, and it',
                'says so in the VERSIONED table here (#618, #851)',
              ].join(' '),
            )
          }
        }
      }
    })
  it('compares the version in force outside every negation', function() {
    for (const [kind, keys] of Object.entries(SELECTORS)) {
      for (const name of names(kind)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, kind, `${name}.yaml`),
        )
        for (const key of keys) {
          assert.ok(
            !inverts(check[key] ?? ''),
            [
              `${kind}/${name} compares ${FLOOR}(.) inside a not() in its`,
              `${key}, so the NaN an undeclared or malformed version answers`,
              'fails the comparison and the negation reports what it meant',
              'to leave unjudged; state the condition for a report',
              'positively instead (#851, #1062)',
            ].join(' '),
          )
        }
      }
    }
  })
  it('packs every check reading the version against an unversioned input',
    function() {
      for (const [kind, dir] of Object.entries(PACKED)) {
        const bare = new Set(
          allFilesFrom(path.join(RESOURCES, dir))
            .filter((file) => file.endsWith('.yaml'))
            .map((file) => yaml.parsedFromFile(file))
            .filter((yml) => (yml.inputs || [yml.input])
              .some((input) => unversioned(xml.parsedFromString(input))))
            .map((yml) => yml.pack),
        )
        for (const name of names(kind)) {
          const check = yaml.parsedFromFile(
            path.join(CHECKS, kind, `${name}.yaml`),
          )
          assert.ok(
            !SELECTORS[kind].some((key) => (check[key] ?? '').includes(FLOOR)) ||
              bare.has(name),
            [
              `${kind}/${name} asks ${FLOOR}(.) and no pack of it lints a`,
              'stylesheet declaring no version, so nothing pins what it',
              'answers where the version in force is NaN (#1062)',
            ].join(' '),
          )
        }
      }
    })
  it('cannot let a pack input hold nothing of XSLT', function() {
    for (const dir of fs.readdirSync(RESOURCES)
      .filter((one) => one.endsWith('-packs'))) {
      for (const pack of allFilesFrom(path.join(RESOURCES, dir))
        .filter((file) => file.endsWith('.yaml'))) {
        const yml = yaml.parsedFromFile(pack)
        for (const input of yml.inputs || [yml.input]) {
          assert.ok(
            stylish(xml.parsedFromString(input)),
            [
              `pack ${dir}/${path.basename(pack)} holds a document with`,
              'nothing in the XSLT namespace, so no check can see a single',
              'node of it and any amount it claims would pass',
            ].join(' '),
          )
        }
      }
    }
  })
  it('maps every motive and pack back to a real check', function() {
    for (const kind of KINDS) {
      const checks = new Set(names(kind))
      for (const motive of allFilesFrom(path.join(MOTIVES, kind))
        .filter((file) => file.endsWith('.md'))) {
        assert.ok(
          checks.has(path.basename(motive, '.md')),
          `motive ${kind}/${path.basename(motive)} names no check`,
        )
      }
    }
    const every = new Set(KINDS.flatMap((kind) => names(kind)))
    for (const dir of fs.readdirSync(RESOURCES)
      .filter((one) => one.endsWith('-packs'))) {
      for (const pack of allFilesFrom(path.join(RESOURCES, dir))
        .filter((file) => file.endsWith('.yaml'))) {
        assert.ok(
          every.has(yaml.parsedFromFile(pack).pack),
          `pack ${dir}/${path.basename(pack)} names no check`,
        )
      }
    }
    for (const [kind, dir] of Object.entries(PACKED)) {
      const checks = new Set(names(kind))
      for (const pack of allFilesFrom(path.join(RESOURCES, dir))
        .filter((file) => file.endsWith('.yaml'))) {
        assert.ok(
          checks.has(yaml.parsedFromFile(pack).pack),
          `pack ${dir}/${path.basename(pack)} names no check`,
        )
      }
    }
  })
})
