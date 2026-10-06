/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Orchestrates discovery, config, staging and output; exports the pure `lint`
 * (package `main`), `fixed`, and `STAGES`, derived from the linter lists so
 * the speed gate times what the run runs. `lint` sorts its defects by file,
 * line, column and check, in code units rather than `localeCompare`, so a
 * committed report diffs stably (#638). A run reads only what `SUFFIXES`
 * names (#924); the walk opens no `.git` or `node_modules`, prunes what a
 * `dir/**` exclude covers whole (#923), and leaves out what `.gitignore`
 * refuses (#929). The exit code is `process.exitCode`, as `process.exit` drops
 * a report still in the pipe (#767). `xslint-lsp` runs `fixed` on unsaved
 * buffers, so no fix stands on text that does not parse (#336, #636).
 */

const path = require('path')
const fs = require('fs')
const {
  absentOf, allFilesFrom, compared, slashed, subsetsOf,
} = require('./helpers')
const {ignoring} = require('./gitignore')
const {parted} = require('./source')
const {SUGGESTION, suppressed} = require('./checks')
const {recorded, matched, trimmed} = require('./baseline')
const {kinds} = require('./resources/checks.json')
const {validate: validateXsls, names: xslChecks} =
  require('./validators/xsl-validator')
const {
  validate: validateXpaths, names: xpathValidatorChecks,
} = require('./validators/xpath-validator')
const {lintByXpath, names: xpathChecks} = require('./linters/xpath-linter')
const {lintByCorpus, names: corpusChecks} = require('./linters/corpus-linter')
const {lintByAxis, names: axisChecks} = require('./linters/xpath-axis-linter')
const {lintByNamespaceAxis, names: namespaceAxisChecks} =
  require('./linters/using-namespace-axis-linter')
const {lintByNamespace, names: namespaceChecks} =
  require('./linters/namespace-linter')
const {lintByResultNamespace, names: resultNamespaceChecks} =
  require('./linters/result-namespace-linter')
const {lintByImports, names: importChecks} = require('./linters/import-linter')
const {lintByOutput, names: outputChecks} =
  require('./linters/output-linter')
const {lintByParameter, names: parameterChecks} =
  require('./linters/parameter-linter')
const {lintByElement, names: elementChecks} =
  require('./linters/element-linter')
const {lintByVariable, names: variableChecks} =
  require('./linters/variable-linter')
const {lintByRootTemplate, names: rootTemplateChecks} =
  require('./linters/root-template-linter')
const {lintByNodeSet, names: nodeSetChecks} =
  require('./linters/node-set-linter')
const {lintByDoubleSlash, names: doubleSlashChecks} =
  require('./linters/double-slash-linter')
const {lintByCount, names: countChecks} = require('./linters/count-linter')
const {lintByDoubleNegation, names: doubleNegationChecks} =
  require('./linters/redundant-double-negation-linter')
const {lintByPredicatePosition, names: predicatePositionChecks} =
  require('./linters/predicate-position-linter')
const {lintByBooleanCall, names: booleanCallChecks} =
  require('./linters/redundant-boolean-call-linter')
const {lintByStringLength, names: stringLengthChecks} =
  require('./linters/string-length-linter')
const {lintByName, names: nameChecks} = require('./linters/name-linter')
const {lintByTranslate, names: translateChecks} =
  require('./linters/translate-linter')
const {lintByBareName, names: bareNameChecks} =
  require('./linters/bare-name-linter')
const {lintByFormat, names: formatChecks} =
  require('./linters/xpath-format-linter')
const {fixed} = require('./fixer')
const {logger, levels} = require('./logger')
const {reporterOf} = require('./reporters')
const {configFrom} = require('./config')
const {directivesFrom, suppresses, unused} = require('./directives')
const {minimatch} = require('minimatch')

/**
 * Linters paired with the checks they own, each given the corpus of well-
 * formed stylesheets. `checks` feeds `CHECKS`, so a linter and its names stay
 * in step. What is left here reads the document rather than the expressions it
 * carries: the two declarative loaders and the four asking about namespaces,
 * imports and parameters.
 * @type {Array.<{name: string,
 *  run: function(Array.<{file: string, xsl: Document}>,
 *  Array.<string>): Array.<object>, checks: Array.<string>}>}
 */
const LINTERS = [
  {name: 'xpath-linter', run: lintByXpath, checks: xpathChecks},
  {name: 'corpus-linter', run: lintByCorpus, checks: corpusChecks},
  {name: 'namespace-linter', run: lintByNamespace, checks: namespaceChecks},
  {
    name: 'result-namespace-linter',
    run: lintByResultNamespace,
    checks: resultNamespaceChecks,
  },
  {name: 'import-linter', run: lintByImports, checks: importChecks},
  {name: 'output-linter', run: lintByOutput, checks: outputChecks},
  {name: 'parameter-linter', run: lintByParameter, checks: parameterChecks},
  {name: 'element-linter', run: lintByElement, checks: elementChecks},
  {name: 'variable-linter', run: lintByVariable, checks: variableChecks},
  {
    name: 'root-template-linter',
    run: lintByRootTemplate,
    checks: rootTemplateChecks,
  },
]

/**
 * Expression linters paired with their checks, each given the valid
 * expressions the validator kept, so a fault the validator has already
 * reported draws one defect rather than a second from every check that reads
 * the same text (#750). Ten of them scanned the whole corpus; the exclusion is
 * structural now, with no gate to remember.
 * @type {Array.<{name: string,
 *  run: function(Array.<{source: object, found: object}>,
 *  Array.<string>): Array.<object>, checks: Array.<string>}>}
 */
const EXPRESSION_LINTERS = [
  {name: 'xpath-axis-linter', run: lintByAxis, checks: axisChecks},
  {
    name: 'using-namespace-axis-linter',
    run: lintByNamespaceAxis,
    checks: namespaceAxisChecks,
  },
  {name: 'node-set-linter', run: lintByNodeSet, checks: nodeSetChecks},
  {
    name: 'double-slash-linter',
    run: lintByDoubleSlash,
    checks: doubleSlashChecks,
  },
  {name: 'count-linter', run: lintByCount, checks: countChecks},
  {
    name: 'string-length-linter',
    run: lintByStringLength,
    checks: stringLengthChecks,
  },
  {name: 'name-linter', run: lintByName, checks: nameChecks},
  {name: 'translate-linter', run: lintByTranslate, checks: translateChecks},
  {
    name: 'redundant-double-negation-linter',
    run: lintByDoubleNegation,
    checks: doubleNegationChecks,
  },
  {
    name: 'redundant-boolean-call-linter',
    run: lintByBooleanCall,
    checks: booleanCallChecks,
  },
  {
    name: 'predicate-position-linter',
    run: lintByPredicatePosition,
    checks: predicatePositionChecks,
  },
  {name: 'bare-name-linter', run: lintByBareName, checks: bareNameChecks},
  {name: 'xpath-format-linter', run: lintByFormat, checks: formatChecks},
]

/**
 * Every linting stage a run passes through, with what it is handed — the
 * corpus, or the expressions the validator kept — and the checks it owns, a
 * stage run under every name but one being how a check is weighed alone.
 * Derived from the two lists, so neither a linter nor a check can be wired into
 * the pipeline and left out of what measures it (#756, #811).
 * @type {Array.<{name: string, over: string, checks: Array.<string>,
 *  run: function(Array, Array.<string>): Array.<object>}>}
 */
const STAGES = [
  ...LINTERS.map(
    ({name, run, checks}) => ({
      name: name, run: run, over: 'corpus', checks: checks,
    }),
  ),
  ...EXPRESSION_LINTERS.map(
    ({name, run, checks}) => ({
      name: name, run: run, over: 'expressions', checks: checks,
    }),
  ),
]

/**
 * Check names owned by the two validators, which run outside the linter loop.
 * @type {Array.<string>}
 */
const VALIDATOR_CHECKS = [...xslChecks, ...xpathValidatorChecks]

/**
 * Names of every check across all validators and linters, that suppressions
 * match against — derived from the linters so it cannot fall out of sync.
 * @type {Array.<string>}
 */
const CHECKS = [
  ...VALIDATOR_CHECKS,
  ...LINTERS.flatMap((stage) => stage.checks),
  ...EXPRESSION_LINTERS.flatMap((stage) => stage.checks),
]

/**
 * The tiers each check declares under its `fix:`, which is the one place a
 * tier is spelled: a check naming one grades every fix it offers, so no linter
 * repeats it, and a check naming both leaves the grade where the linter put
 * it, the tier there belonging to the place a defect stands (#899).
 * @type {Map.<string, Array.<string>>}
 */
const TIERED = new Map(
  Object.values(kinds).flatMap((kind) => Object.entries(kind))
    .map(([name, check]) => [name, [check.fix ?? []].flat()]),
)

/**
 * The check lists a run may start from, by name: every check there is, and
 * the ones whose own `preset:` puts them in `recommended`, which a run reports
 * when it names no preset — what a processor refuses, and the dead code whose
 * report is almost never wrong over the three corpora (#1094).
 * @type {{[name: string]: Array.<string>}}
 */
const PRESETS = {
  recommended: CHECKS.filter(
    (check) => Object.values(kinds).some(
      (kind) => kind[check]?.preset === 'recommended',
    ),
  ),
  all: CHECKS,
}

/**
 * The preset a run starts from when neither a flag nor a file names one.
 * @type {string}
 */
const PRESET = 'recommended'

/**
 * The checks a preset holds, refused outright where no preset has the name,
 * since a run over a list of nothing would read as a clean report (#1094).
 * @param {string} name - Name of the preset
 * @return {Array.<string>} - Names of the checks it holds
 */
const presetted = function(name) {
  if (!Object.hasOwn(PRESETS, name)) {
    throw new Error(
      [
        `Preset '${name}' does not exist,`,
        `use one of ${Object.keys(PRESETS).join(', ')}`,
      ].join(' '),
    )
  }
  return PRESETS[name]
}

/**
 * Whether only `--fix-suggestions` may apply the fix a defect carries, as its
 * check declares — falling back on what the linter said where the check
 * declares nothing, since a run is no place to refuse a fix over it (#899).
 * @param {string} check - Check name
 * @param {object} fix - The fix the linter built
 * @return {boolean} - Whether it is a suggestion
 */
const suggests = function(check, fix) {
  const declared = TIERED.get(check)
  let tier = Boolean(fix.suggestion)
  if (declared.length === 1) {
    tier = declared[0] === SUGGESTION
  }
  return tier
}

/**
 * Deleting incorrect substring-suppressions from array of arguments
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {Array.<string>} - Normalizing list of suppressions
 */
const validatedSuppressions = function(suppressions) {
  for (const sup of suppressions) {
    if (!CHECKS.some((check) => check.includes(sup))) {
      logger.warn(
        [
          `Check with substring '${sup}' does not exist.`,
          `Delete this '--suppress' or use another one.`,
        ].join(' '),
      )
    }
  }
  if (suppressions.some((sup) => sup === '')) {
    logger.warn(
      [
        'Empty suppress is incorrect.',
        'Delete this "--suppress" or use another one.',
      ].join(' '),
    )
    suppressions = suppressions.filter((sup) => (sup) !== '')
  }
  return suppressions
}

/**
 * The checks a run narrowed to some substrings reports, or where it names none
 * the preset's and every check it re-grades (#1094). A choice naming no check
 * is warned about, since a typo would otherwise narrow the run to nothing and
 * read as a clean report (#1030).
 * @param {Array.<string>} only - Substrings of the names chosen
 * @param {Array.<string>} listed - Names of the checks the preset holds
 * @param {Array.<string>} graded - Names of the checks the run re-grades
 * @return {Array.<string>} - Names of the checks chosen
 */
const chosenOf = function(only, listed, graded) {
  for (const choice of only) {
    if (!CHECKS.some((check) => check.includes(choice))) {
      logger.warn(
        [
          `Check with substring '${choice}' does not exist.`,
          `Delete this '--only' or use another one.`,
        ].join(' '),
      )
    }
  }
  return selected(only, listed, graded)
}

/**
 * The checks `chosenOf` answers, chosen without a word about a choice naming
 * none, so a caller asking again after the run warns nothing twice.
 * @param {Array.<string>} only - Substrings of the names chosen
 * @param {Array.<string>} listed - Names of the checks the preset holds
 * @param {Array.<string>} graded - Names of the checks the run re-grades
 * @return {Array.<string>} - Names of the checks chosen
 */
const selected = function(only, listed, graded) {
  let chosen = CHECKS.filter(
    (check) => listed.includes(check) || graded.includes(check),
  )
  if (only.length > 0) {
    chosen = CHECKS.filter(
      (check) => only.some((choice) => check.includes(choice)),
    )
  }
  return chosen
}

/**
 * The checks a run under these settings reports, chosen and left unsuppressed,
 * so a baseline judges and rewrites only the entries the run could draw.
 * @param {{suppress: Array.<string>, overrides: object, only: Array.<string>,
 *  preset: string}} settings - What `settingsOf` answers
 * @return {Array.<string>} - Names of the checks run
 */
const ranOf = function(
  {suppress = [], overrides = {}, only = [], preset = PRESET},
) {
  return selected(only, presetted(preset), Object.keys(overrides)).filter(
    (check) => !suppressed(check, suppress.filter((sup) => sup !== '')),
  )
}

/**
 * The checks left out of a narrowed run, spelled as suppressions — all but a
 * name standing inside a chosen one, which a suppression, matching by
 * substring, would silence with it; what those leave standing is filtered
 * off the report instead (#1030).
 * @param {Array.<string>} chosen - Names of the checks chosen
 * @return {Array.<string>} - Names safe to suppress
 */
const unchosenOf = function(chosen) {
  return CHECKS.filter(
    (check) => !chosen.includes(check) &&
      !chosen.some((name) => name.includes(check)),
  )
}

/**
 * Whether a run ran every check a directive names, or every check there is
 * where it names none. A check the run skipped drew no defect for the
 * directive to cover, so its silence says nothing about the directive, and
 * calling it unused told an author to delete a live line (#1049).
 * @param {{names: Array.<string>}} directive - A directive from a file
 * @param {Array.<string>} suppressions - What the run skipped, `--only` too
 * @return {boolean} - True when the run can judge the directive
 */
const judged = function(directive, suppressions) {
  let names = directive.names
  if (names.length === 0) {
    names = CHECKS
  }
  return !names.some((name) => suppressed(name, suppressions))
}

/**
 * The suffixes a stylesheet is named with, both spellings of the one thing.
 * @type {Array.<string>}
 */
const SUFFIXES = ['.xsl', '.xslt']

/**
 * Whether a path names a stylesheet, by the suffix it carries.
 * @param {string} file - Path of a file
 * @return {boolean} - True when its suffix is one a stylesheet wears
 */
const suffixed = function(file) {
  return SUFFIXES.some((suffix) => file.endsWith(suffix))
}

/**
 * The tail a pattern wears when it covers everything a directory holds, which
 * is the one shape that makes the directory safe to leave unopened.
 * @type {RegExp}
 */
const COVERING = /\/\*\*$/

/**
 * The mark a pattern opens with when it excludes everything it does *not*
 * name, which covers no directory whatever tail it wears.
 * @type {RegExp}
 */
const NEGATED = /^!/

/**
 * How every path of ours is matched: a leading dot names a directory like
 * any other here, so a wildcard reads one rather than passing it over.
 * @type {object}
 */
const DOTTED = {dot: true}

/**
 * Whether a file matches any exclusion glob.
 * @param {string} file - Absolute path of a stylesheet
 * @param {Array.<string>} patterns - Exclusion globs from the configuration
 * @param {string} base - Directory the globs resolve against
 * @return {boolean} - True when the file is excluded
 */
const excluded = function(file, patterns, base) {
  return patterns.some(
    (pattern) => minimatch(slashed(file, base), pattern, DOTTED),
  )
}

/**
 * Whether a directory is one the walk may leave unopened, which it is when a
 * pattern excludes everything under it rather than the directory alone or
 * everything beside it: a `dir/**` covers every file the walk would find
 * there, where a bare `dir` names a path no walk hands back and a negated
 * pattern covers nothing at all (#923).
 * @param {string} dir - Absolute path of a directory
 * @param {Array.<string>} patterns - Exclusion globs from the configuration
 * @param {string} base - Directory the globs resolve against
 * @return {boolean} - True when nothing under it can be reported
 */
const pruned = function(dir, patterns, base) {
  return patterns.some(
    (pattern) => COVERING.test(pattern) && !NEGATED.test(pattern) &&
      minimatch(
        slashed(dir, base), pattern.replace(COVERING, ''), DOTTED,
      ),
  )
}

/**
 * What the configuration's own exclusions reached, asked as the two questions
 * a run puts to them and remembered as it answers: whether to leave a
 * directory unopened, and whether to drop a file the walk handed back. A
 * pattern met at either door has excluded something; one met at neither has
 * excluded nothing, which is what `unreached` names (#951).
 * @param {Array.<string>} patterns - Exclusion globs from the configuration
 * @param {string} base - Directory the globs resolve against
 * @return {object} - `walking()`, `directory(dir)`, `file(file)` and
 *  `unreached()`
 */
const reaching = function(patterns, base) {
  const met = new Set()
  let walked = false
  /**
   * Whether a door excludes this path, remembering every pattern that did.
   * @param {string} pth - Absolute path of a directory or of a stylesheet
   * @param {function(string, Array.<string>, string): boolean} judge - The
   *  door asked, `pruned` or `excluded`
   * @return {boolean} - True where a pattern of the list excludes it
   */
  const noting = function(pth, judge) {
    const hit = patterns.filter((pattern) => judge(pth, [pattern], base))
    hit.forEach((pattern) => met.add(pattern))
    return hit.length > 0
  }
  /**
   * The patterns neither door ever met, which is none where no directory was
   * walked: a run handed the one file it is to read excludes nothing by
   * anything, and that says about the run rather than about the glob.
   * @return {Array.<string>} - The exclusions that excluded nothing
   */
  const unreached = function() {
    let left = []
    if (walked) {
      left = patterns.filter((pattern) => !met.has(pattern))
    }
    return left
  }
  return {
    walking: () => {
      walked = true
    },
    directory: (dir) => noting(dir, pruned),
    file: (file) => noting(file, excluded),
    unreached: unreached,
  }
}

/**
 * The stylesheets a path holds: the file itself, or every one a directory has
 * under it, keeping only what a stylesheet is named. A directory an exclusion
 * covers whole is never opened (#923), nor is one the project's own
 * `.gitignore` files name (#929); a path named outright is read whatever
 * either says.
 * @param {string} pth - Path to a stylesheet or a directory holding some
 * @param {object} reach - What the exclusions have reached, from `reaching`
 * @return {Array.<string>} - Paths of the stylesheets found
 */
const sheets = function(pth, reach) {
  let files = [pth].filter((file) => suffixed(file))
  if (fs.statSync(pth).isDirectory()) {
    reach.walking()
    const ignored = ignoring(pth)
    files = allFilesFrom(
      pth, (dir) => reach.directory(dir) || ignored.directory(dir),
    ).filter((file) => suffixed(file) && !ignored.file(file))
  }
  return files
}

/**
 * The log level a quiet flag and an explicit level resolve to: quiet forces
 * warnings-only, otherwise the explicit level, otherwise info.
 * @param {boolean|null|undefined} quiet - Whether to drop informational logs
 * @param {string|null|undefined} level - Explicit level, if any
 * @return {string} - The level to set
 */
const leveled = function(quiet, level) {
  let chosen = level ?? levels.INFO
  if (quiet) {
    chosen = levels.WARNING
  }
  return chosen
}

/**
 * Where a defect stands in a report: by the file holding it, then by the line
 * and the column it stands at, then by the check that found it. A total order
 * over the defects themselves, so a report carries neither the order the
 * filesystem handed the stylesheets over in nor the order the linters happen to
 * be wired in (#638).
 * @param {object} one - A defect
 * @param {object} two - Another defect
 * @return {number} - Negative, zero or positive, as a comparator answers
 */
const ranked = function(one, two) {
  return compared(one.file, two.file) ||
    one.line - two.line ||
    one.pos - two.pos ||
    compared(one.name, two.name)
}

/**
 * Lint stylesheet sources and return the defects, without touching the
 * filesystem, printing output, or exiting — the reusable core the command line
 * wraps and an editor or LSP can call in-process. Each defect carries `{name,
 * severity, message, file, line, pos}` and, when fixable, a `fix`. Inline
 * `xslint-disable` directives are honored.
 * @param {Array.<{file: string, content: string, subsets: Map,
 *  absent: Set}>} sources - Raw stylesheets, what their parameter entities
 *  name, and the hrefs no file stands behind, read by the caller (#1010, #209)
 * @param {{suppress: Array.<string>, overrides: {[check: string]: string},
 *  only: Array, preset: string}} options - Skips, re-grades, choices and the
 *  preset a run starts from, `recommended` unless named (#1094)
 * @return {Array.<object>} - The defects that survive suppression
 */
const lint = function(
  sources, {suppress = [], overrides = {}, only = [], preset = PRESET} = {},
) {
  const chosen = chosenOf(only, presetted(preset), Object.keys(overrides))
  const suppressions = [
    ...validatedSuppressions(suppress), ...unchosenOf(chosen),
  ]
  const read = sources.map((source) => ({
    file: source.file, content: parted(source.content).text,
    subsets: source.subsets ?? new Map(),
    absent: source.absent ?? new Set(),
  }))
  const {corpus, defects: malformed} = validateXsls(read, suppressions)
  const {expressions, defects: invalid} = validateXpaths(corpus, suppressions)
  const defects = [
    ...malformed,
    ...invalid,
    ...LINTERS.flatMap(({run}) => run(corpus, suppressions)),
    ...EXPRESSION_LINTERS.flatMap(({run}) => run(expressions, suppressions)),
  ]
  for (const defect of defects) {
    if (overrides[defect.name]) {
      defect.severity = overrides[defect.name]
    }
    if (defect.fix) {
      defect.fix.suggestion = suggests(defect.name, defect.fix)
    }
  }
  const directives = new Map(
    read.map((source) => [source.file, directivesFrom(source.content)]),
  )
  for (const [file, list] of directives) {
    for (const directive of list) {
      for (const name of directive.names) {
        if (!CHECKS.includes(name)) {
          logger.warn(
            `Rule '${name}' in an xslint-disable directive does not exist`,
          )
        }
      }
    }
    const found = defects.filter((defect) => defect.file === file)
    for (const stale of unused(
      list.filter((directive) => judged(directive, suppressions)), found,
    )) {
      logger.warn(`Unused xslint-disable directive at ${file}:${stale.line}`)
    }
  }
  return defects.filter(
    (defect) => chosen.includes(defect.name) &&
      !suppresses(directives.get(defect.file), defect),
  ).sort(ranked)
}

/**
 * What a run under one configuration hands `lint`: the preset, the choice, the
 * suppressions and the re-grades it spells with the flags laid over it,
 * whether its `exclude:` keeps a file out, and a rule naming no check as a
 * problem rather than a warning. An exact name in `rules` adds its check to
 * the run while a glob re-grades only what already runs (#1094, #1128).
 * @param {object} config - The configuration, as `configFrom` resolves it
 * @param {{preset: string, only: Array.<string>, suppress: Array.<string>}}
 *  flags - What the caller says over the file
 * @return {{suppress: Array, overrides: object, preset: string, only: Array,
 *  excluded: function(string): boolean, exclude: Array, base: string,
 *  file: (string|undefined), problems: Array}} - What `lint` takes, and more
 */
const settingsFrom = function(config, flags = {}) {
  const preset = flags.preset ?? config.preset ?? PRESET
  const listed = presetted(preset)
  let only = config.only
  if (flags.only?.length > 0) {
    only = flags.only
  }
  const disabled = []
  const overrides = {}
  const problems = []
  for (const [pattern, severity] of Object.entries(config.rules)) {
    const matched = CHECKS.filter((check) => minimatch(check, pattern))
    if (matched.length === 0) {
      problems.push(`Rule '${pattern}' in configuration does not exist`)
    }
    for (const check of matched) {
      if (severity === 'off') {
        disabled.push(check)
      } else if (
        check === pattern || only.length > 0 || listed.includes(check)
      ) {
        overrides[check] = severity
      }
    }
  }
  return {
    suppress: [...flags.suppress ?? [], ...disabled],
    overrides: overrides,
    only: only,
    preset: preset,
    excluded: (file) => excluded(file, config.exclude, config.base),
    exclude: config.exclude,
    base: config.base,
    file: config.file,
    problems: problems,
  }
}

/**
 * What a run over one project hands `lint`, read off the `.xslint.yml`
 * nearest to it the way the command line reads it, the problems of the file
 * standing in front of those of its rules. Nothing is printed, so an editor
 * asking once a keystroke shows the problems where it will (#1128).
 * @param {string} from - Directory the search for `.xslint.yml` starts in
 * @param {{config: string, preset: string, only: Array.<string>,
 *  suppress: Array.<string>}} flags - What the caller says over the file
 * @return {{suppress: Array, overrides: object, preset: string, only: Array,
 *  excluded: function(string): boolean, exclude: Array, base: string,
 *  file: (string|undefined), problems: Array}} - What `lint` takes, and more
 * @throws {Error} - On a preset naming no check list, or a file no YAML parser
 *  reads, as the command line fails on both before it lints
 */
const settingsOf = function(from, flags = {}) {
  const config = configFrom(flags.config, from)
  const settings = settingsFrom(config, flags)
  return {...settings, problems: [...config.problems, ...settings.problems]}
}

/**
 * The stylesheets a run over the paths named reads, each resolved against the
 * working directory and walked by the rules the command line walks by, and the
 * warnings it prints on the way handed back as `problems`, so it logs nothing
 * above the debug level and an editor linting a workspace reads the corpus the
 * command line does (#1136).
 * @param {Array.<string>} pths - Files or directories holding stylesheets
 * @param {{exclude: Array.<string>, base: string}} settings - What
 *  `settingsOf` answers, whose exclusions prune the walk
 * @return {{stylesheets: Array.<string>, problems: Array.<string>}} - The
 *  absolute paths of the stylesheets found, and one sentence per warning
 */
const stylesheetsOf = function(pths, settings) {
  const reach = reaching(settings.exclude, settings.base)
  const problems = []
  let stylesheets = []
  for (const pth of pths.map((named) => path.resolve(process.cwd(), named))) {
    if (!fs.existsSync(pth)) {
      problems.push(`File or directory ${pth} does not exist`)
    } else if (!fs.statSync(pth).isDirectory() && !suffixed(pth)) {
      problems.push(
        [
          `File ${pth} was not read,`,
          `a stylesheet being named ${SUFFIXES.join(' or ')}`,
        ].join(' '),
      )
    } else {
      stylesheets = [...stylesheets, ...sheets(pth, reach)]
    }
  }
  stylesheets = stylesheets.filter((file) => !reach.file(file))
  return {
    stylesheets: stylesheets,
    problems: [
      ...problems,
      ...reach.unreached().map(
        (pattern) => `Exclusion '${pattern}' in configuration excluded nothing`,
      ),
    ],
  }
}

/**
 * The record `lint` takes for one stylesheet, built from the content given
 * rather than from the disk, so an editor hands over a buffer nobody saved:
 * the parameter entity files and the missing hrefs are still read beside the
 * file, as the command line reads them (#1010, #209, #1136).
 * @param {string} file - Path of the stylesheet
 * @param {string} content - Its source
 * @return {{file: string, content: string, subsets: Map.<string, string>,
 *  absent: Set.<string>}} - The source `lint` takes
 */
const sourceOf = function(file, content) {
  return {
    file: file,
    content: content,
    subsets: subsetsOf(file, content),
    absent: absentOf(file, content),
  }
}

/**
 * The entries of a baseline whose file still stands beside it and whose check
 * xslint still has, so a prune or a rewrite drops the entries of a sheet
 * deleted since and of a check renamed or retired.
 * @param {object} baseline - What the baseline file holds
 * @param {string} base - Directory the baseline file lives in
 * @return {object} - The same entries, less those of every missing file and
 *  unknown check
 */
const standing = function(baseline, base) {
  return Object.fromEntries(
    Object.entries(baseline)
      .filter(([file]) => fs.existsSync(path.resolve(base, file)))
      .map(([file, checks]) => [
        file,
        Object.fromEntries(
          Object.entries(checks).filter(([name]) => CHECKS.includes(name)),
        ),
      ]),
  )
}

/**
 * Entry point for the command line.
 * @param {Array.<string>} pths - Files or directories with .xsl to lint
 * @param {object} options - CLI options: `logLevel`, `quiet`, `suppress`,
 *  `maxWarnings`, `config`, `format`, `only`, `preset`, `fix`, `fixDryRun`,
 *  `fixSuggestions`, `baseline`, `baselineWrite`, `baselinePrune`
 */
module.exports = function xslint(pths, options) {
  logger.setLevel(leveled(options.quiet, options.logLevel))
  const config = configFrom(options.config)
  config.problems.forEach((problem) => logger.warn(problem))
  if (options.quiet == null && options.logLevel == null) {
    logger.setLevel(leveled(config.quiet, config.logLevel))
  }
  const settings = settingsFrom(config, options)
  settings.problems.forEach((problem) => logger.warn(problem))
  const maxWarnings = options.maxWarnings ?? config.maxWarnings ?? -1
  const fixing = options.fix || options.fixDryRun || options.fixSuggestions
  if (options.baselineWrite && fixing) {
    throw new Error(
      'Option --baseline-write records what a run finds and cannot run with a fix flag',
    )
  }
  let ledger
  if (options.baseline) {
    ledger = path.resolve(options.baseline)
  } else if (config.baseline) {
    ledger = path.resolve(config.base, config.baseline)
  }
  if (options.baselinePrune && !ledger) {
    throw new Error(
      'Option --baseline-prune rewrites the file --baseline names and cannot run without one',
    )
  }
  let target
  let earlier = {}
  if (options.baselineWrite) {
    target = path.resolve(options.baselineWrite)
    if (fs.existsSync(target)) {
      earlier = JSON.parse(fs.readFileSync(target, 'utf-8'))
    }
  } else if (ledger) {
    earlier = JSON.parse(fs.readFileSync(ledger, 'utf-8'))
  }
  logger.info(`Directories and files to process: ${pths.join(', ')}`)
  const found = stylesheetsOf(pths, settings)
  found.problems.forEach((problem) => logger.warn(problem))
  logger.debug(`Found ${found.stylesheets.length} stylesheets to process`)
  const sources = found.stylesheets.map(
    (stylesheet) => sourceOf(stylesheet, fs.readFileSync(stylesheet, 'utf-8')),
  )
  const drawn = lint(sources, settings)
  let reported = drawn
  if (fixing) {
    /**
     * @todo #571:60min Fix over several passes until nothing changes: a fix
     *  `fixer.js` skips for overlapping another is never applied, so `--fix`
     *  under-delivers and reports a defect the winner already removed.
     */
    const {contents, applied} = fixed(sources, reported, options.fixSuggestions)
    for (const [file, content] of contents) {
      if (!options.fixDryRun) {
        fs.writeFileSync(file, content)
      }
    }
    if (applied.length > 0) {
      logger.info(`Fixed ${applied.length} defects in ${contents.size} files`)
    }
    reported = reported.filter((defect) => !applied.includes(defect))
  } else {
    const auto = reported.filter(
      (defect) => defect.fix && !defect.fix.suggestion,
    )
    const suggested = reported.filter(
      (defect) => defect.fix && defect.fix.suggestion,
    )
    if (auto.length > 0) {
      logger.info(`${auto.length} defects fixable with --fix`)
    }
    if (suggested.length > 0) {
      logger.info(`${suggested.length} more fixable with --fix-suggestions`)
    }
  }
  if (target) {
    fs.writeFileSync(
      target,
      `${JSON.stringify(recorded(reported, sources, path.dirname(target), ranOf(settings), standing(earlier, path.dirname(target))), null, 2)}\n`,
    )
    logger.info(`Recorded ${reported.length} defects in ${target}`)
    reported = []
  } else if (ledger) {
    const {fresh, stale} = matched(
      drawn, sources, earlier, path.dirname(ledger), ranOf(settings),
    )
    if (options.baselinePrune) {
      fs.writeFileSync(
        ledger,
        `${JSON.stringify(trimmed(drawn, sources, standing(earlier, path.dirname(ledger)), path.dirname(ledger), ranOf(settings)), null, 2)}\n`,
      )
      logger.info(`Pruned the stale entries of ${ledger}`)
    } else {
      stale.forEach((entry) => logger.error(
        [
          `Baseline entry ${entry.file} records ${entry.count} ${entry.name}`,
          `defects the run no longer draws, drop them from ${ledger} with`,
          '--baseline-prune',
        ].join(' '),
      ))
    }
    if (stale.length > 0 && !options.baselinePrune) {
      process.exitCode = 1
    }
    reported = reported.filter((defect) => fresh.includes(defect))
  }
  logger.info(`Processed files: ${found.stylesheets.length}`)
  if (reported.length > 0) {
    logger.info(`Defects found: ${reported.length}`)
  } else {
    logger.info(`No defects found`)
  }
  reporterOf(options.format)(reported)
  const errors = reported.filter((defect) => defect.severity === 'error')
  const warnings = reported.filter((defect) => defect.severity === 'warning')
  if (
    errors.length > 0 ||
    (maxWarnings >= 0 && warnings.length > maxWarnings)
  ) {
    process.exitCode = 1
  }
}

module.exports.lint = lint
module.exports.fixed = fixed
module.exports.settingsOf = settingsOf
module.exports.ranOf = ranOf
module.exports.stylesheetsOf = stylesheetsOf
module.exports.sourceOf = sourceOf
module.exports.STAGES = STAGES
module.exports.PRESETS = PRESETS
module.exports.SUFFIXES = SUFFIXES
module.exports.suffixed = suffixed
module.exports.excluded = excluded
module.exports.pruned = pruned
