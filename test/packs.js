/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, xml, yaml} = require('../src/helpers')
const {kinds} = require('../src/resources/checks.json')
const path = require('path')
const assert = require('assert')

/**
 * The check of a name, as a run reads one: the entry `checks.json` holds under
 * it, whichever of the four kinds declares it. The lookup is by the defect's
 * own name rather than by the directory's, since a pack may name a neighbour
 * firing on the same construct and the two are graded apart.
 * @param {string} name - The check's name
 * @return {object} - Its entry, holding at least a severity and a message
 */
const graded = function(name) {
  return Object.values(kinds)
    .map((held) => held[name])
    .filter((entry) => entry !== undefined)[0]
}

/**
 * The corpus a pack stands for: one `test.xsl` where it gives an `input`, or a
 * `file<index>.xsl` for each entry where it gives `inputs` and the check it is
 * about reads across files.
 * @param {object} yml - The parsed pack
 * @return {Array.<{file: string, content: string, xsl: Document}>} - The corpus
 */
const corpusOf = function(yml) {
  let held = [{content: yml.input}]
  if (yml.inputs) {
    held = yml.inputs.map((input) => ({content: input}))
  }
  return held.map((one, index) => ({
    file: `file${index}.xsl`,
    content: one.content,
    xsl: xml.parsedFromString(one.content),
  }))
}

/**
 * Whether the pack numbers its files, which decides how a position reads: a
 * cross-file pack spells `[fileIndex, line, column]` where a single-file one
 * spells `[line, column]` and may name a co-firing check third.
 * @param {object} yml - The parsed pack
 * @return {boolean} - True when its positions carry a file index
 */
const spread = function(yml) {
  return Boolean(yml.inputs)
}

/**
 * Assert that a defect stands where the pack puts it, and answers to the check
 * the pack names — or to the one a single-file position names third, which is
 * how a pack pins a neighbour firing on the same construct.
 * @param {object} defect - The defect the linter reported
 * @param {Array.<number|string>} place - The position the pack spells
 * @param {object} yml - The parsed pack
 */
const stands = function(defect, place, yml) {
  let line = place[0]
  let column = place[1]
  let called = place[2] ?? yml.pack
  if (spread(yml)) {
    assert.equal(
      defect.file, `file${place[0]}.xsl`,
      `the defect stands in ${defect.file} where the pack puts it in file ` +
        `${place[0]} of the corpus`,
    )
    line = place[1]
    column = place[2]
    called = yml.pack
  }
  assert.equal(
    defect.line, line,
    `the defect stands on line ${defect.line} where the pack puts it on ${line}`,
  )
  assert.equal(
    defect.pos, column,
    `the defect stands at column ${defect.pos} where the pack puts it at ` +
      `${column}`,
  )
  assert.equal(
    defect.name, called,
    `the defect answers to ${defect.name} where the pack names ${called}`,
  )
  const check = graded(called)
  assert.equal(
    defect.severity, check.severity,
    `the defect is graded ${defect.severity} where ${called} is a ` +
      `${check.severity}`,
  )
  assert.equal(
    defect.message, check.message,
    `the defect reads "${defect.message}" where ${called} says ` +
      `"${check.message}"`,
  )
}

/**
 * A prefix of a check's name, so that suppression is asked the way a user
 * spells it — `--suppress` matches by substring, and a test naming the check in
 * full would pass against an implementation comparing the two for identity.
 * @param {string} name - The check's name
 * @return {string} - Its name up to the last hyphen, or the whole of it
 */
const shortened = function(name) {
  let term = name
  if (name.lastIndexOf('-') > 0) {
    term = name.slice(0, name.lastIndexOf('-'))
  }
  return term
}

/**
 * One pack per check the directory expects a defect from — every check, since a
 * linter often serves more than one and suppressing the first says nothing
 * about the second. A directory whose packs all expect nothing yields none, and
 * asks nothing of suppression, there being no defect to silence.
 * @param {Array.<{at: string, yml: object}>} packs - The directory's packs
 * @return {Array.<{at: string, yml: object}>} - One loud pack per check
 */
const checked = function(packs) {
  const seen = new Set()
  return packs.filter((pack) => {
    const fresh = pack.yml.found.amount > 0 && !seen.has(pack.yml.pack)
    if (fresh) {
      seen.add(pack.yml.pack)
    }
    return fresh
  })
}

/**
 * Every check a directory's packs expect a defect from, read straight off the
 * packs. It answers the same question as {@link checked} by another route, so
 * that the two can be held against each other: the first spelling of that
 * function marked a name seen whether or not the pack was loud, so a directory
 * whose quiet pack came first — `element-packs`, `double-slash-packs` —
 * registered no suppression test at all and said nothing about it.
 * @param {Array.<{at: string, yml: object}>} packs - The directory's packs
 * @return {Array.<string>} - The names, sorted, without repeats
 */
const expecting = function(packs) {
  return [...new Set(packs.filter((pack) => pack.yml.found.amount > 0)
    .map((pack) => pack.yml.pack))].sort()
}

/**
 * The one harness every pack directory is read through. It was twenty-two
 * files, the same loop with four things swapped — the module required, the
 * directory read, the noun in the title, and the shape of the lint call — and
 * duplication of a test is not free the way duplication of a fixture is: every
 * assertion the packs are supposed to carry had to be written twenty-two times,
 * and one written twenty-one times failed nowhere. That is how `import-packs`
 * came to assert no fix at all while `redundant-import` attached a real
 * deletion, unseen from #519 to #607; four of the copies never asserted the
 * defect's own name and twenty never read `found.values` (#660).
 *
 * So each assertion lives here once and every directory gets all of them. What
 * a pack does not spell it is not asked — `fixes` and `values` are asserted
 * where the pack declares them — but a `fixes` key is required of a format pack
 * by `test/conformance.test.js`, which reads the packs rather than the harness
 * and so cannot be satisfied by a harness that quietly asserts nothing.
 * The suppression each directory now gets is the plainest case of that: six of
 * the twenty-two asserted that a check goes quiet when the run turns it off,
 * and sixteen did not. It is asked of the first pack expecting a defect, under
 * that pack's own check name, so no directory has to name anything.
 * @param {{dir: string, noun: string,
 *  run: function(Array, Array): Array}} what - The directory to
 *  read, the noun its titles count, and how to get defects from a corpus,
 *  given the checks the run suppresses
 */
const harness = function(what) {
  const packs = allFilesFrom(path.resolve(__dirname, 'resources', what.dir))
    .map((pack) => ({at: pack, yml: yaml.parsedFromFile(pack)}))
  it('asks suppression of every check its packs expect a defect from',
    function() {
      assert.deepStrictEqual(
        checked(packs).map((pack) => pack.yml.pack).sort(),
        expecting(packs),
        'a check some pack expects a defect from is asked nothing about ' +
          'suppression, so a linter ignoring what the run turns off would ' +
          'pass — and a directory registering no such test at all reads ' +
          'exactly like one where every check is covered',
      )
    })
  checked(packs).forEach((loud) => {
    it(`cannot report ${loud.yml.pack} where the run suppresses it`,
      function() {
        const term = shortened(loud.yml.pack)
        assert.equal(
          what.run(corpusOf(loud.yml), [term])
            .filter((defect) => defect.name === loud.yml.pack).length,
          0,
          `the linter reported ${loud.yml.pack} in ` +
            `${path.basename(loud.at)} though the run suppresses "${term}", ` +
            'so nothing a user turns off through --suppress or a config ' +
            'would go quiet',
        )
      })
  })
  packs.forEach(
    ({at, yml}) => {
      describe(`testing ${path.basename(at)} pack`, function() {
        it(`should find ${yml.found.amount} ${what.noun}`, function() {
          const defects = what.run(corpusOf(yml), [])
          assert.equal(
            defects.length, yml.found.amount,
            `the pack expects ${yml.found.amount} defects and the linter ` +
              `found ${defects.length}`,
          )
          yml.found.positions.forEach(
            (place, index) => stands(defects[index], place, yml),
          )
          const fixes = yml.found.fixes ?? []
          fixes.forEach((expected, index) => assert.equal(
            defects[index].fix?.replacement ?? null, expected,
            `the fix replaces with ${defects[index].fix?.replacement} where ` +
              `the pack expects ${expected}`,
          ))
          const values = yml.found.values ?? []
          values.forEach((expected, index) => assert.equal(
            defects[index].fix?.value ?? null, expected,
            `the fix reads ${defects[index].fix?.value} where the pack ` +
              `expects ${expected}`,
          ))
        })
      })
    },
  )
}

module.exports = {
  harness,
}
