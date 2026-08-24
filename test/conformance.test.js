/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, xml, yaml} = require('../src/helpers')
const {ATTRIBUTES, PATTERNS} = require('../src/attributes')
const {GAP} = require('../src/tokens')
const {splitOf} = require('../src/selectors')
const {kinds} = require('../src/resources/checks.json')
const {FIXERS} = require('../src/fixers')
const {DECIMAL, XSLT} = require('../src/xsl-version')
const {walked} = require('../src/tree')
const {authored, rendered, PLACE} = require('../scripts/generate-checks')
const {GUIDES} = require('./guides')
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
  'malformed-version-in-stylesheet': 'a bracketed union of attribute paths',
  'missing-id-in-stylesheet': 'the root itself, not a descendant sweep',
  'missing-version-in-stylesheet': 'the root itself, not a descendant sweep',
  'modern-construct-in-xslt-1': 'a union arm carrying a predicate of its own',
  'not-using-output': 'the root itself, not a descendant sweep',
  'stylesheet-has-no-templates': 'the root itself, not a descendant sweep',
  'text-outside-xsl-text': 'a wildcard names no one bucket',
  'too-many-templates': 'the root itself, not a descendant sweep',
}

/**
 * Whether a shared walk can serve every branch of a selector, each branch's
 * axis being elements out of a bucket or attributes off the same walk — either
 * an axis the run has already paid for, where any other shape costs fontoxpath
 * a descendant traversal of its own. A union is served whole or not at all, so
 * one branch it cannot reach answers for the selector (#635, #784, #811).
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
 * The prose read whole, every count in it being a count of one of the two
 * lists: the module holding them. A number written beside a list is a fact that
 * rots — three places said `ATTRIBUTES` held nineteen names where it has held
 * twenty since #633, one of them wrong on the day the list grew (#654).
 * @type {Array.<string>}
 */
const PROSE = ['src/attributes.js']

/**
 * The prose read where it *names* a list, since a document counts many things
 * and only some of them are these. Reading one whole judged four claims,
 * ignored eleven, and turned red on a correct branch touching no list; the
 * identifier tells the two apart. The guides are walked rather than written
 * down, #821 having moved each derivation into its own directory.
 * @type {Array.<string>}
 */
const DOCUMENTS = GUIDES.concat(['README.md'])

/**
 * Each list as a document may name it, paired with what it holds. `NAMED` is
 * `ATTRIBUTES` as a set, so it counts to the same and answers to a claim about
 * either name.
 * @type {Map.<string, number>}
 */
const LENGTHS = new Map([
  ['ATTRIBUTES', ATTRIBUTES.length],
  ['PATTERNS', PATTERNS.length],
  ['NAMED', ATTRIBUTES.length],
])

/**
 * How far past a list's name a count may stand and still be a count of it. One
 * clause is the reach — the two claims in the tree stand 3 and 12 characters
 * off, `PATTERNS`' five names` and ``PATTERNS` names the five attributes` — and
 * a number further away than this belongs to a sentence about something else,
 * which is the whole of what anchoring buys.
 * @type {number}
 */
const NEARBY = 80

/**
 * The words a count is spelled with, paired with what each counts to. A `Map`
 * and not an object, because membership is the whole of what is asked of it and
 * `'constructor' in {}` answers true: an object judges a claim about "the
 * constructor names" against `Object` itself rather than reading past a word
 * that is no number, so the prototype chain decides what the prose is about.
 * @type {Map.<string, number>}
 */
const NUMBERS = new Map([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two',
  'twenty-three',
].map((word, index) => [word, index + 1]))

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
 * #492). So `not(text()[normalize-space()])` stands beside the count.
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
 * Each exemption table beside the question deciding whether its entries are
 * still needed, so one gate holds every table from the far side.
 * @type {Array.<{table: object, still: function(string): boolean}>}
 */
const EXEMPTED = [
  {table: COUNTING, still: (sel) => CHILDREN.test(sel) && !TEXTED.test(sel)},
  {table: EMITTED, still: (sel) => TEXTED.test(sel) && !PRESERVED.test(sel)},
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
 * The prose of a file as one line, so a claim that wraps mid-sentence reads as
 * the one claim it is: two of the three counts #654 corrected were wrapped
 * between the number and its noun, and a gate reading line by line missed them.
 * A continuation asterisk goes with the indent in front of it, a JSDoc carrying
 * one per line.
 * @param {string} named - Path of the file from the repository root
 * @return {string} - Its prose, joined
 */
const worded = function(named) {
  return fs.readFileSync(path.resolve(__dirname, '..', named), 'utf-8')
    .split('\n').map((line) => line.replace(/^ *\* ?/, '')).join(' ')
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

describe('conformance', function() {
  it('keeps the generated checks abreast of the YAML that authors them', function() {
    assert.equal(
      fs.readFileSync(PLACE.to, 'utf-8'), rendered(authored()),
      `${path.basename(PLACE.to)} is not what the YAML under ` +
        `${path.basename(PLACE.from)}/ says any more, and it is what a run ` +
        'reads, so the check you edited is not the check that fires; run ' +
        '`npx grunt checks`',
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
  it('freezes every mature check behind a complete motive and working fix', function() {
    const fixerSuite = fs.readFileSync(
      path.join(__dirname, 'fixer.deep.test.js'), 'utf-8',
    )
    for (const kind of KINDS) {
      for (const name of names(kind)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, kind, `${name}.yaml`),
        )
        if (check.mature !== true) {
          continue
        }
        const motive = fs.readFileSync(
          path.join(MOTIVES, kind, `${name}.md`), 'utf-8',
        )
        assert.ok(
          /^Incorrect/im.test(motive) && /^Correct/im.test(motive),
          `mature ${kind}/${name} has no Incorrect/Correct example in its motive`,
        )
        const before = path.join(RESOURCES, 'fix', `${name}.xsl`)
        if (Object.hasOwn(FIXERS, name) || fs.existsSync(before)) {
          assert.ok(
            fs.existsSync(before) &&
              fs.existsSync(path.join(RESOURCES, 'fix', `${name}.fixed.xsl`)),
            `mature ${kind}/${name} is fixable but has no fix fixture pair`,
          )
          assert.ok(
            fixerSuite.includes(name),
            `mature ${kind}/${name} is fixable but fixer.deep.test.js never runs it`,
          )
        }
      }
    }
  })
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
      'a pack expecting more defects than it gives positions for asserts ' +
        'nothing about where they stand, since every harness walks the ' +
        'positions rather than the count',
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
      'a pack directory no harness call names goes unread, and every ' +
        'assertion over its packs goes with it, which nothing else here can ' +
        'notice: the harness being one function, the call handing it a ' +
        'directory is the whole of what runs that directory. Deleting the ' +
        'call for xpath-packs took all thirty-eight declarative checks out ' +
        'of the suite and left eslint, npm test and a 100% coverage run ' +
        'green (#660). A name matched twice is the same hole the other way, ' +
        'a directory read under one call and a second name spelled for ' +
        'nothing',
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
        'a test file reading what a pack expects is a second copy of the ' +
          'harness, and an assertion written into every copy but one fails ' +
          'nowhere: that is how import-packs came to assert no fix while ' +
          'redundant-import attached a real deletion (#660). Read the ' +
          'directory through the harness in test/packs.js, which asserts ' +
          'the amount, the positions, the name, the severity, the message, ' +
          'the fixes and the values of every pack it is given',
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
      `a test file that starts a child process is not named '${DEEP}', or one ` +
        'that starts none is, so the fast half of the suite runs the wrong files',
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
      'a test that writes a file without asking for a temporary directory ' +
        'leaves it in the working tree, where the run that lints the ' +
        'repository walks over it and loses its count (#687)',
    )
  })
  it('caps how far a source file may grow', async function() {
    assert.ok(
      (await import('../eslint.config.mjs')).default
        .some((entry) => Array.isArray(entry.rules?.['max-lines'])),
      'nothing in eslint.config.mjs caps the length of a source file, so the ' +
        'next one to sprawl past what a reader can hold passes lint',
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
      'a file the line cap is switched off for stands under it now, or names ' +
        'nothing at all, so the exemption in eslint.config.mjs claims a ' +
        'length the tree no longer holds',
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
            `${kind}/${name} compares count(...) with 0 in its ${key}; ` +
              'write the node test itself, as count-compared-to-zero asks',
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
              `${kind}/${name} counts the elements a node holds in its ` +
                `${key} and asks nothing about its text, which answers the ` +
                'same question: a construct holding one instruction and a ' +
                'string of text holds more than the instruction, and the ' +
                'check reports it as though it did not. Weigh the text ' +
                'beside the count, as not(text()[normalize-space()]) does',
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
              `${kind}/${name} reads text() in its ${key} to decide whether ` +
                'a node holds content and never asks about xml:space, so it ' +
                'reads past a whitespace-only node the nearest preserve in ' +
                'scope keeps. Weigh that node too, the way ' +
                'ancestor::*[@xml:space][1] answers it',
            )
          }
        }
      }
    })
  it('exempts a selector only while it still needs the exemption', function() {
    for (const {table, still} of EXEMPTED) {
      for (const name of Object.keys(table)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, 'xpath', `${name}.yaml`),
        )
        assert.ok(
          still(check.xpath),
          `xpath/${name} is exempt on the grounds that ${table[name]}, and ` +
            'no longer needs it: the selector either stopped spelling the ' +
            'shape the bar is about, or answers the bar already. Drop it',
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
              `${kind}/${name} calls name() in its ${key}, which answers the ` +
                'prefix a document happens to spell a node with, so the check ' +
                'is blind to every stylesheet binding the XSLT namespace to ' +
                'another one. Write a namespace-bound node test instead, such ' +
                'as //(xsl:variable | xsl:template); where the set is negated ' +
                'and no union can spell it, local-name() reads no prefix and ' +
                'is allowed',
            )
          }
        }
      }
    })
  it('cannot list a check that is no longer written as a selector', function() {
    assert.deepStrictEqual(
      Object.keys(UNINDEXED).filter((name) => !names('xpath').includes(name)),
      [],
      'a name in the UNINDEXED table of test/conformance.test.js is not an ' +
        'xpath check any more, so its entry is asserting nothing: a check that ' +
        'has moved to code, or been renamed, or been deleted takes its ' +
        'exemption with it',
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
      'a cross-file selector is no longer served from the walk in ' +
        'src/tree.js. Both sides of such a check grow with the project and the ' +
        'work is their product, so a descendant traversal here is the dearest ' +
        'one there is: the every-attribute usage three of the four are written in cost ' +
        'fontoxpath 1.613 s over DocBook-XSL, 18% of the whole run, against 8 ' +
        'ms off the walk. Unlike the per-file kind there is no table of ' +
        'exemptions, four selectors of one shape each being few enough that a ' +
        'fifth belongs in that shape too (#811)',
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
      'a selector and the UNINDEXED table in test/conformance.test.js no ' +
        'longer agree. A selector that cannot be served from the walk in ' +
        'src/tree.js costs fontoxpath a descendant traversal of its own, which ' +
        'it performs quadratically over an xmldom tree, so a new one belongs ' +
        'in that table with the shape that puts it there — or, better, gets ' +
        'written as a descendant sweep of named elements. A selector listed ' +
        'there and served anyway has outgrown its entry, and the entry goes: ' +
        `${drifted.join(', ')}`,
    )
  })
  it('anchors every reference template against text at one end', function() {
    const loose = names('corpus')
      .map((name) => ({
        name,
        reference: yaml.parsedFromFile(
          path.join(CHECKS, 'corpus', `${name}.yaml`),
        ).reference,
      }))
      .filter((check) => check.reference)
      .filter((check) => {
        const stands = check.reference.indexOf('{name}')
        return (stands > 0) ===
          (stands + '{name}'.length < check.reference.length)
      })
      .map((check) => check.name)
    assert.deepStrictEqual(
      loose, [],
      `${loose.join(', ')} anchors {name} against text at neither end or at ` +
        'both, where the index in src/linters/corpus-linter.js reads the ' +
        'name from the one side the text stands on. Against neither, the ' +
        'mark is the empty string, which indexOf finds at every offset and ' +
        'answers the length for past the end rather than -1, so the scan ' +
        'never advances and the run hangs. Against both, the far side is ' +
        'never matched and a declaration that is used is reported as dead',
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
              `${kind}/${name} compares its ${key} with ${match[0]} and not ` +
                `with ${twin}, so a stylesheet spelling that string the other ` +
                'way round goes unreported (#549)',
            )
          }
        }
      }
    }
  })
  it('pairs every root xsl:stylesheet with an xsl:transform', function() {
    const rooted = /(?<!\/)\/xsl:stylesheet/
    const paired = /(?<!\/)\/xsl:transform/
    for (const [kind, keys] of Object.entries(SELECTORS)) {
      for (const name of names(kind)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, kind, `${name}.yaml`),
        )
        for (const key of keys) {
          if (check[key] && rooted.test(check[key])) {
            assert.ok(
              paired.test(check[key]),
              `${kind}/${name} anchors on /xsl:stylesheet but not /xsl:transform`,
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
      'malformed-version-in-stylesheet writes its own xs:decimal pattern rather ' +
        'than the DECIMAL of src/xsl-version.js, so the check and the reader ' +
        'it reports for can disagree on what a version is',
    )
  })
  it('reads @xsl:version too wherever a selector tests @version', function() {
    const versioned = /@version/
    for (const [kind, keys] of Object.entries(SELECTORS)) {
      for (const name of names(kind)) {
        const check = yaml.parsedFromFile(
          path.join(CHECKS, kind, `${name}.yaml`),
        )
        for (const key of keys) {
          if (check[key] && versioned.test(check[key])) {
            assert.ok(
              check[key].includes('@xsl:version'),
              `${kind}/${name} tests @version but not @xsl:version, ` +
                'so it misreads a simplified stylesheet',
            )
          }
        }
      }
    }
  })
  it('counts the attribute lists as long as they are, where it counts them', function() {
    const claimed = new RegExp(
      `(?:the|those|these|its|of)${GAP}+([a-z-]+)${GAP}+` +
      `(?:names|attributes|descendant scans)`, 'g',
    )
    const lengths = new Set(LENGTHS.values())
    for (const file of PROSE) {
      for (const [claim, word] of worded(file).matchAll(claimed)) {
        if (NUMBERS.has(word)) {
          assert.ok(
            lengths.has(NUMBERS.get(word)),
            `${file} says "${claim}", and neither ATTRIBUTES nor PATTERNS ` +
              `holds ${NUMBERS.get(word)} — say what the list holds, or make ` +
              'the claim about something a reader can count',
          )
        }
      }
    }
  })
  it('counts a list a document names against that very list', function() {
    const near = new RegExp(
      `(${[...LENGTHS.keys()].join('|')})(?=(.{0,${NEARBY}}))`, 'g',
    )
    const counted = new RegExp(
      `([a-z-]+)${GAP}+(?:names|attributes|descendant scans)`,
    )
    for (const file of DOCUMENTS) {
      for (const [, list, after] of worded(file).matchAll(near)) {
        const claim = after.match(counted)
        if (claim && NUMBERS.has(claim[1])) {
          assert.equal(
            NUMBERS.get(claim[1]), LENGTHS.get(list),
            `${file} names ${list} and calls it "${claim[0]}", where it holds ` +
              `${LENGTHS.get(list)} — the count beside a list is the one thing ` +
              'a reader takes on trust, so it answers to the list',
          )
        }
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
            `pack ${dir}/${path.basename(pack)} holds a document with ` +
              'nothing in the XSLT namespace, so no check can see a single ' +
              'node of it and any amount it claims would pass',
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
