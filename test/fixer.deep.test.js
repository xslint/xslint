/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {runXslint, xslintStreams} = require('./helpers')
const {fixed} = require('../src/fixer')
const {xml} = require('../src/helpers')
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * Read one of the committed fix fixtures.
 * @param {string} name - Fixture base name
 * @return {string} - The fixture's content
 */
const fixture = function(name) {
  return fs.readFileSync(
    path.resolve(__dirname, 'resources', 'fix', name),
    'utf-8',
  )
}

/**
 * Copy the given content into a fresh temporary file, so a fixing run never
 * mutates the committed fixture, and return its path.
 * @param {string} content - Stylesheet to seed the file with
 * @return {string} - Path of the temporary stylesheet
 */
const scratch = function(content) {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'xslint-fix-')),
    'sheet.xsl',
  )
  fs.writeFileSync(file, content)
  return file
}

/**
 * Every rewritten stylesheet the fixer is expected to produce. A fix spliced
 * with a stale offset eats whatever sits at the tail of its span — an
 * attribute's closing quote, most often — so each of these is parsed back to
 * prove the fixer left valid XML behind.
 * @type {Array.<string>}
 */
const REWRITTEN = fs
  .readdirSync(path.resolve(__dirname, 'resources', 'fix'))
  .filter((name) => name.endsWith('.fixed.xsl'))

/**
 * Cases where two fixes contend for one span, with the text the winner leaves
 * behind. The loser is listed first, so a run that merely keeps the order it
 * was given fails.
 * @type {Array.<{name: string, content: string, fixes: Array.<object>,
 *  after: string}>}
 */
const CONTENDING = [
  {
    name: 'cannot apply a fix that overlaps an accepted one',
    content: 'XYZ',
    fixes: [
      {name: 'inner', fix: {line: 1, col: 2, value: 'YZ', replacement: 'W'}},
      {name: 'outer', fix: {line: 1, col: 1, value: 'XYZ', replacement: 'Q'}},
    ],
    after: 'Q',
  },
  {
    name: 'should prefer the wider of two fixes that start together',
    content: 'XYZ',
    fixes: [
      {name: 'narrow', fix: {line: 1, col: 1, value: 'X', replacement: 'Q'}},
      {name: 'wider', fix: {line: 1, col: 1, value: 'XYZ', replacement: 'W'}},
    ],
    after: 'W',
  },
]

/**
 * Cases where a flag rewrites the `before` fixture into the `after` one.
 * @type {Array.<{name: string, flag: string, before: string, after: string}>}
 */
const APPLIED = [
  {
    name: 'should collapse redundant whitespace in place with --fix',
    flag: '--fix',
    before: 'redundant-whitespace.xsl',
    after: 'redundant-whitespace.fixed.xsl',
  },
  {
    name: 'should abbreviate verbose axes in place with --fix',
    flag: '--fix',
    before: 'unabbreviated-axis.xsl',
    after: 'unabbreviated-axis.fixed.xsl',
  },
  {
    name: 'should abbreviate an axis in a wrapped value with --fix',
    flag: '--fix',
    before: 'unabbreviated-axis-in-a-wrapped-value.xsl',
    after: 'unabbreviated-axis-in-a-wrapped-value.fixed.xsl',
  },
  {
    name: 'should delete a redundant namespace declaration with --fix',
    flag: '--fix',
    before: 'redundant-namespace-declarations.xsl',
    after: 'redundant-namespace-declarations.fixed.xsl',
  },
  {
    name: 'should drop the redundant leading slashes of a match with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    before: 'starts-with-double-slash.xsl',
    after: 'starts-with-double-slash.fixed.xsl',
  },
  {
    name: 'should drop the redundant leading slashes of a pattern outside a ' +
      'template with --fix',
    flag: '--fix',
    before: 'starts-with-double-slash-outside-a-template.xsl',
    after: 'starts-with-double-slash-outside-a-template.fixed.xsl',
  },
  {
    name: 'should delete a redundant import with --fix',
    flag: '--fix',
    before: 'redundant-import.xsl',
    after: 'redundant-import.fixed.xsl',
  },
  {
    name: 'should delete four of five duplicate imports with --fix',
    flag: '--fix',
    before: 'redundant-import-many.xsl',
    after: 'redundant-import-many.fixed.xsl',
  },
  {
    name: 'should unwrap the node-set extension with --fix',
    flag: '--fix',
    before: 'use-node-set-extension.xsl',
    after: 'use-node-set-extension.fixed.xsl',
  },
  {
    name: 'should rewrite double negations, to boolean() in a select and to ' +
      'the bare argument in a whole test, with --fix',
    flag: '--fix',
    before: 'redundant-double-negation.xsl',
    after: 'redundant-double-negation.fixed.xsl',
  },
  {
    name: 'should strip a boolean() wrapping a whole test with --fix',
    flag: '--fix',
    before: 'redundant-boolean-call.xsl',
    after: 'redundant-boolean-call.fixed.xsl',
  },
  {
    name: 'should shorten positional predicates with --fix',
    flag: '--fix',
    before: 'predicate-position-literal.xsl',
    after: 'predicate-position-literal.fixed.xsl',
  },
  {
    name: 'should rewrite a count comparison to exists/empty with --fix',
    flag: '--fix',
    before: 'count-compared-to-zero.xsl',
    after: 'count-compared-to-zero.fixed.xsl',
  },
  {
    name: 'should rewrite a count comparison to boolean/not/bare on 1.0 ' +
      'with --fix',
    flag: '--fix',
    before: 'count-in-xslt-1-0.xsl',
    after: 'count-in-xslt-1-0.fixed.xsl',
  },
  {
    name: 'should rewrite an entity-encoded count comparison with --fix',
    flag: '--fix',
    before: 'count-entity-comparison.xsl',
    after: 'count-entity-comparison.fixed.xsl',
  },
  {
    name: 'should rewrite a count comparison shifted by an earlier entity ' +
      'with --fix',
    flag: '--fix',
    before: 'count-shifted-comparison.xsl',
    after: 'count-shifted-comparison.fixed.xsl',
  },
  {
    name: 'should rewrite a count comparison inside an attribute value ' +
      'template, leaving the output text of the same line alone, with --fix',
    flag: '--fix',
    before: 'count-in-result-attribute.xsl',
    after: 'count-in-result-attribute.fixed.xsl',
  },
  {
    name: 'should rewrite both count comparisons of one attribute value, the ' +
      'second shifted by the entity in the first, with --fix',
    flag: '--fix',
    before: 'count-in-attribute-value-templates.xsl',
    after: 'count-in-attribute-value-templates.fixed.xsl',
  },
  {
    name: 'should rewrite a count comparison inside a text value template ' +
      'with --fix',
    flag: '--fix',
    before: 'count-in-text-value-template.xsl',
    after: 'count-in-text-value-template.fixed.xsl',
  },
  {
    name: 'should keep the widest of the fixes that overlap with --fix',
    flag: '--fix',
    before: 'overlapping-fixes.xsl',
    after: 'overlapping-fixes.fixed.xsl',
  },
  {
    name: 'should unwrap only the outer of two nested double negations with ' +
      '--fix',
    flag: '--fix',
    before: 'nested-double-negation.xsl',
    after: 'nested-double-negation.fixed.xsl',
  },
  {
    name: 'should rewrite a string-length comparison to != / = with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    before: 'string-length-compared-to-zero.xsl',
    after: 'string-length-compared-to-zero.fixed.xsl',
  },
  {
    name: 'should rewrite a name comparison to a node test with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    before: 'name-compared-to-string.xsl',
    after: 'name-compared-to-string.fixed.xsl',
  },
  {
    name: 'should rewrite a translate case fold to lower/upper-case with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    before: 'translate-for-case.xsl',
    after: 'translate-for-case.fixed.xsl',
  },
  {
    name: 'should exclude a leaking prefix with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'leaking-result-namespace.xsl',
    after: 'leaking-result-namespace.fixed.xsl',
  },
  {
    name: 'should append to an existing exclude-result-prefixes with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    before: 'leaking-result-namespace-appended.xsl',
    after: 'leaking-result-namespace-appended.fixed.xsl',
  },
  {
    name: 'should rewrite a boolean-constant test to true()/false() with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    before: 'incorrect-use-of-boolean-constants.xsl',
    after: 'incorrect-use-of-boolean-constants.fixed.xsl',
  },
  {
    name: 'should anchor a leading // select as .// with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'select-starts-with-double-slash.xsl',
    after: 'select-starts-with-double-slash.fixed.xsl',
  },
  {
    name: 'should prepend $ to a bare variable name with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'confusing-variable-and-node.xsl',
    after: 'confusing-variable-and-node.fixed.xsl',
  },
  {
    name: 'should wrap loose text in xsl:text with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'text-outside-xsl-text.xsl',
    after: 'text-outside-xsl-text.fixed.xsl',
  },
  {
    name: 'should apply a suggestion with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'using-disable-output-escaping.xsl',
    after: 'using-disable-output-escaping.fixed.xsl',
  },
  {
    name: 'should switch an xml output method to html with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'output-method-xml.xsl',
    after: 'output-method-xml.fixed.xsl',
  },
  {
    name: 'should declare a missing version with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'missing-version-in-stylesheet.xsl',
    after: 'missing-version-in-stylesheet.fixed.xsl',
  },
  {
    name: 'should drop an orphan mode with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'mode-or-priority-without-match.xsl',
    after: 'mode-or-priority-without-match.fixed.xsl',
  },
  {
    name: 'should delete the select of a variable, param and with-param that ' +
      'also have a body with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'variable-or-param-with-select-and-content.xsl',
    after: 'variable-or-param-with-select-and-content.fixed.xsl',
  },
  {
    name: 'should delete a select however its delimiter and gaps are spelled ' +
      'with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'variable-or-param-with-select-spelled-oddly.xsl',
    after: 'variable-or-param-with-select-spelled-oddly.fixed.xsl',
  },
  {
    name: 'should delete a single-quoted and a spaced ' +
      'disable-output-escaping with --fix-suggestions',
    flag: '--fix-suggestions',
    before: 'using-disable-output-escaping-spelled-oddly.xsl',
    after: 'using-disable-output-escaping-spelled-oddly.fixed.xsl',
  },
]

/**
 * Cases where a flag leaves the `sheet` fixture untouched — a dry run, or a
 * plain `--fix` declining a suggestion.
 * @type {Array.<{name: string, flag: string, sheet: string}>}
 */
const UNCHANGED = [
  {
    name: 'cannot touch the file with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'redundant-whitespace.xsl',
  },
  {
    name: 'cannot drop the leading slashes with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'starts-with-double-slash.xsl',
  },
  {
    name: 'cannot drop the leading slashes of a pattern with plain --fix',
    flag: '--fix',
    sheet: 'starts-with-double-slash.xsl',
  },
  {
    name: 'cannot delete a redundant import with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'redundant-import.xsl',
  },
  {
    name: 'cannot strip a boolean() wrapper with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'redundant-boolean-call.xsl',
  },
  {
    name: 'cannot shorten positional predicates with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'predicate-position-literal.xsl',
  },
  {
    name: 'cannot rewrite a count comparison with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'count-compared-to-zero.xsl',
  },
  {
    name: 'cannot rewrite a 1.0 count comparison with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'count-in-xslt-1-0.xsl',
  },
  {
    name: 'cannot abbreviate a predicated step in a 1.0 stylesheet with --fix',
    flag: '--fix',
    sheet: 'unabbreviated-axis-in-xslt-1.xsl',
  },
  {
    name: 'cannot rewrite an entity-encoded comparison with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'count-entity-comparison.xsl',
  },
  {
    name: 'cannot rewrite a double negation with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'redundant-double-negation.xsl',
  },
  {
    name: 'cannot rewrite a string-length comparison with --fix-dry-run',
    flag: '--fix-dry-run',
    sheet: 'string-length-compared-to-zero.xsl',
  },
  {
    name: 'cannot rewrite a string-length comparison with plain --fix',
    flag: '--fix',
    sheet: 'string-length-compared-to-zero.xsl',
  },
  {
    name: 'cannot rewrite a name comparison with plain --fix',
    flag: '--fix',
    sheet: 'name-compared-to-string.xsl',
  },
  {
    name: 'cannot rewrite a translate case fold with plain --fix',
    flag: '--fix',
    sheet: 'translate-for-case.xsl',
  },
  {
    name: 'cannot exclude a leaking prefix with plain --fix',
    flag: '--fix',
    sheet: 'leaking-result-namespace.xsl',
  },
  {
    name: 'cannot rewrite a boolean-constant test with plain --fix',
    flag: '--fix',
    sheet: 'incorrect-use-of-boolean-constants.xsl',
  },
  {
    name: 'cannot anchor a leading // select with plain --fix',
    flag: '--fix',
    sheet: 'select-starts-with-double-slash.xsl',
  },
  {
    name: 'cannot prepend $ to a bare variable name with plain --fix',
    flag: '--fix',
    sheet: 'confusing-variable-and-node.xsl',
  },
  {
    name: 'cannot wrap loose text in xsl:text with plain --fix',
    flag: '--fix',
    sheet: 'text-outside-xsl-text.xsl',
  },
  {
    name: 'cannot apply a suggestion with plain --fix',
    flag: '--fix',
    sheet: 'using-disable-output-escaping.xsl',
  },
  {
    name: 'cannot delete a select beside a body with plain --fix',
    flag: '--fix',
    sheet: 'variable-or-param-with-select-and-content.xsl',
  },
  {
    name: 'cannot delete a select whose value holds a numeric entity with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'variable-with-select-holding-a-numeric-entity.xsl',
  },
  {
    name: 'cannot delete a declaration exclude-result-prefixes names with ' +
      '--fix',
    flag: '--fix',
    sheet: 'an-excluded-result-prefix.xsl',
  },
]

/**
 * Cases where a flag fixes a defect, so its check name leaves the report.
 * @type {Array.<{name: string, flag: string, sheet: string, check: string}>}
 */
const DROPPED = [
  {
    name: 'should drop the fixed defect from the report',
    flag: '--fix',
    sheet: 'redundant-whitespace.xsl',
    check: 'redundant-whitespace',
  },
  {
    name: 'should drop the abbreviated axis from the report',
    flag: '--fix',
    sheet: 'unabbreviated-axis.xsl',
    check: 'unabbreviated-axis',
  },
  {
    name: 'should drop the fixed starts-with-double-slash defect from the ' +
      'report',
    flag: '--fix-suggestions',
    sheet: 'starts-with-double-slash.xsl',
    check: 'starts-with-double-slash',
  },
  {
    name: 'should drop the fixed redundant-import defect from the report',
    flag: '--fix',
    sheet: 'redundant-import.xsl',
    check: 'redundant-import',
  },
  {
    name: 'should drop the fixed boolean-call defect from the report',
    flag: '--fix',
    sheet: 'redundant-boolean-call.xsl',
    check: 'redundant-boolean-call',
  },
  {
    name: 'should drop the fixed predicate-position defect from the report',
    flag: '--fix',
    sheet: 'predicate-position-literal.xsl',
    check: 'predicate-position-literal',
  },
  {
    name: 'should drop the fixed count defect from the report',
    flag: '--fix',
    sheet: 'count-compared-to-zero.xsl',
    check: 'count-compared-to-zero',
  },
  {
    name: 'should drop a fixed 1.0 count defect from the report',
    flag: '--fix',
    sheet: 'count-in-xslt-1-0.xsl',
    check: 'count-compared-to-zero',
  },
  {
    name: 'should drop a fixed entity-encoded count defect from the report',
    flag: '--fix',
    sheet: 'count-entity-comparison.xsl',
    check: 'count-compared-to-zero',
  },
  {
    name: 'should drop a fixed entity-shifted count defect from the report',
    flag: '--fix',
    sheet: 'count-shifted-comparison.xsl',
    check: 'count-compared-to-zero',
  },
  {
    name: 'should drop the fixed double-negation defect from the report',
    flag: '--fix',
    sheet: 'redundant-double-negation.xsl',
    check: 'redundant-double-negation',
  },
  {
    name: 'should drop the fixed string-length defect with --fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'string-length-compared-to-zero.xsl',
    check: 'string-length-compared-to-zero',
  },
  {
    name: 'should drop the fixed name defect with --fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'name-compared-to-string.xsl',
    check: 'name-compared-to-string',
  },
  {
    name: 'should drop the fixed translate defect with --fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'translate-for-case.xsl',
    check: 'translate-for-case',
  },
  {
    name: 'should drop the fixed leaking-result-namespace defect with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'leaking-result-namespace.xsl',
    check: 'leaking-result-namespace',
  },
  {
    name: 'should drop the fixed boolean-constant defect with --fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'incorrect-use-of-boolean-constants.xsl',
    check: 'incorrect-use-of-boolean-constants',
  },
  {
    name: 'should drop the fixed select-starts-with-double-slash defect with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'select-starts-with-double-slash.xsl',
    check: 'select-starts-with-double-slash',
  },
  {
    name: 'should drop the fixed confusing-variable-and-node defect with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'confusing-variable-and-node.xsl',
    check: 'confusing-variable-and-node',
  },
  {
    name: 'should drop the fixed text-outside-xsl-text defect with ' +
      '--fix-suggestions',
    flag: '--fix-suggestions',
    sheet: 'text-outside-xsl-text.xsl',
    check: 'text-outside-xsl-text',
  },
]

describe('fixer', function() {
  APPLIED.forEach(({name, flag, before, after}) => {
    it(name, function() {
      const file = scratch(fixture(before))
      runXslint([flag, file])
      assert.equal(fs.readFileSync(file, 'utf-8'), fixture(after))
    })
  })
  UNCHANGED.forEach(({name, flag, sheet}) => {
    it(name, function() {
      const file = scratch(fixture(sheet))
      runXslint([flag, file])
      assert.equal(fs.readFileSync(file, 'utf-8'), fixture(sheet))
    })
  })
  DROPPED.forEach(({name, flag, sheet, check}) => {
    it(name, function() {
      const file = scratch(fixture(sheet))
      assert.ok(!xslintStreams([flag, file]).stdout.includes(check))
    })
  })
  it('cannot abbreviate a parent axis that has no short form', function() {
    const file = scratch(fixture('unabbreviated-axis.xsl'))
    runXslint(['--fix', file])
    assert.ok(fs.readFileSync(file, 'utf-8').includes('parent::n'))
  })
  it('should abbreviate an axis in a wrapped value of a CRLF file', function() {
    const file = scratch(
      fixture('unabbreviated-axis-in-a-wrapped-value.xsl')
        .replace(/\n/g, '\r\n'),
    )
    runXslint(['--fix', file])
    assert.equal(
      fs.readFileSync(file, 'utf-8'),
      fixture('unabbreviated-axis-in-a-wrapped-value.fixed.xsl')
        .replace(/\n/g, '\r\n'),
    )
  })
  it('should announce how many defects --fix would fix', function() {
    const file = scratch(fixture('redundant-whitespace.xsl'))
    assert.ok(xslintStreams([file]).stderr.includes('fixable with --fix'))
  })
  it('should announce a suggestion under --fix-suggestions', function() {
    const file = scratch(fixture('using-disable-output-escaping.xsl'))
    assert.ok(
      xslintStreams([file]).stderr.includes('fixable with --fix-suggestions'),
    )
  })
  it('should collapse a run whose span it can verify', function() {
    assert.equal(
      fixed(
        [{file: 'a.xsl', content: 'X  Y'}],
        [{file: 'a.xsl', fix: {line: 1, col: 2, value: '  ', replacement: ' '}}],
      ).contents.get('a.xsl'),
      'X Y',
    )
  })
  it('cannot fix a run whose span no longer matches', function() {
    assert.ok(
      !fixed(
        [{file: 'a.xsl', content: 'X  Y'}],
        [{
          file: 'a.xsl',
          name: 'redundant-whitespace',
          fix: {line: 1, col: 2, value: 'ZZ', replacement: ' '},
        }],
      ).contents.has('a.xsl'),
    )
  })
  it('cannot fix a defect that belongs to another file', function() {
    assert.deepEqual(
      fixed(
        [{file: 'a.xsl', content: 'X  Y'}],
        [{file: 'b.xsl', fix: {line: 1, col: 2, value: '  ', replacement: ' '}}],
      ).applied,
      [],
    )
  })
  it('cannot fix a run that reaches past the end of the file', function() {
    assert.ok(
      !fixed(
        [{file: 'a.xsl', content: 'X'}],
        [{file: 'a.xsl', fix: {line: 1, col: 1, value: 'XY', replacement: 'Z'}}],
      ).contents.has('a.xsl'),
    )
  })
  CONTENDING.forEach(({name, content, fixes, after}) => {
    it(name, function() {
      assert.equal(
        fixed(
          [{file: 'a.xsl', content: content}],
          fixes.map((defect) => ({file: 'a.xsl', ...defect})),
        ).contents.get('a.xsl'),
        after,
      )
    })
  })
  it('cannot count a skipped overlapping fix as applied', function() {
    assert.deepEqual(
      fixed(
        [{file: 'a.xsl', content: 'XYZ'}],
        CONTENDING[0].fixes.map((defect) => ({file: 'a.xsl', ...defect})),
      ).applied.map((defect) => defect.name),
      ['outer'],
    )
  })
  it('should announce a fix skipped for overlapping another', function() {
    const file = scratch(fixture('overlapping-fixes.xsl'))
    assert.ok(
      xslintStreams(['--fix', file]).stderr.includes('overlaps another fix'),
    )
  })
  it('cannot drop a skipped overlapping defect from the report', function() {
    const file = scratch(fixture('overlapping-fixes.xsl'))
    assert.ok(
      xslintStreams(['--fix', file]).stdout.includes('redundant-whitespace'),
    )
  })
  REWRITTEN.forEach((name) => {
    it(`cannot leave ${name} malformed`, function() {
      assert.doesNotThrow(() => xml.parsedFromString(fixture(name)))
    })
  })
})
