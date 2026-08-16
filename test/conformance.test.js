/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, yaml} = require('../src/helpers')
const {GAP} = require('../src/tokens')
const {FIXERS} = require('../src/fixers')
const {DECIMAL} = require('../src/xsl-version')
const {authored, rendered, PLACE} = require('../scripts/generate-checks')
const {Linter} = require('eslint')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

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
 * check's own selector must therefore not commit. One level of nested
 * parentheses is enough for the argument of a count. The gap before the `(` is
 * part of the call: XPath reads an NCName as a FunctionName when a `(` follows
 * it, "possibly after intervening ExprWhitespace", so `count (x) > 0` is the
 * same slow test spelled differently, and the user-facing check does flag it
 * (#621). A gate blind to the space permitted in our own selectors what the
 * check reports in someone else's.
 * @type {RegExp}
 */
const COUNTED = new RegExp(
  `count${GAP}*\\((?:[^()]|\\([^()]*\\))*\\)${GAP}*(?:!?=|[<>]=?)${GAP}*0(?!\\d)`,
)

/**
 * A string literal a selector compares an expression's *text* against, which is
 * a literal whose own content is quoted: `"'true'"` asks whether a `@test`
 * reads `'true'` character for character. XPath spells one string with either
 * delimiter and means the same string by both, so a selector naming one
 * spelling reads half the stylesheets it is about — `test="'true'"` was flagged
 * and `test="&quot;true&quot;"` walked past, the identical always-true constant
 * (#549). Whichever way round a selector writes the pair, the twin must stand
 * beside it.
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
 * Names of the checks of a kind.
 * @param {string} kind - Kind of check
 * @return {Array.<string>} - Check names
 */
const names = function(kind) {
  return allFilesFrom(path.join(CHECKS, kind))
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => path.basename(file, '.yaml'))
}

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
  it('reads the fixes of every format pack in the harness owning it', function() {
    const formats = new Set(names('format'))
    const suites = allFilesFrom(path.resolve(__dirname))
      .filter((file) => file.endsWith('.test.js'))
      .map((file) => fs.readFileSync(file, 'utf-8'))
    assert.deepEqual(
      [...new Set(
        allFilesFrom(RESOURCES)
          .filter((file) => file.endsWith('.yaml'))
          .filter((file) => formats.has(yaml.parsedFromFile(file).pack))
          .map((file) => path.basename(path.dirname(file))),
      )].filter((dir) => !suites.some(
        (suite) => suite.includes(`'${dir}'`) && suite.includes('found.fixes'),
      )),
      [],
      'a pack directory whose harness never reads found.fixes leaves every fix in it unasserted',
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
