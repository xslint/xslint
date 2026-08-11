/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const path = require('path')
const fs = require('fs')
const {allFilesFrom} = require('./helpers')
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
const {lintByNodeSet, names: nodeSetChecks} =
  require('./linters/node-set-linter')
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
const {lintByFormat, names: formatChecks} =
  require('./linters/xpath-format-linter')
const {fixed} = require('./fixer')
const {logger, levels} = require('./logger')
const {reporterOf} = require('./reporters')
const {configFrom} = require('./config')
const {directivesFrom, suppresses, unused} = require('./directives')
const {minimatch} = require('minimatch')

/**
 * Linters paired with the checks they own, each given the corpus of well-formed
 * stylesheets. `checks` feeds `CHECKS`, so a linter and its names stay in step.
 * What is left here reads the document rather than the expressions it carries:
 * the two declarative loaders, which run their selectors over it, and the three
 * that ask about namespaces and imports.
 * @type {Array.<{run: function(Array.<{file: string, xsl: Document}>,
 *  Array.<string>): Array.<object>, checks: Array.<string>}>}
 */
const LINTERS = [
  {run: lintByXpath, checks: xpathChecks},
  {run: lintByCorpus, checks: corpusChecks},
  {run: lintByNamespace, checks: namespaceChecks},
  {run: lintByResultNamespace, checks: resultNamespaceChecks},
  {run: lintByImports, checks: importChecks},
]

/**
 * Expression linters paired with their checks, each given the valid expressions
 * the validator kept, so a fault the validator has already reported draws one
 * defect rather than a second one from every check that reads the same text
 * (#750). Ten of them scanned the whole corpus and asked `expressionsOf`
 * themselves, with `defect` withholding the fix on what the grammar refuses;
 * the exclusion is structural now, and there is no gate for a new check to
 * remember.
 * @type {Array.<{run: function(Array.<{source: object, found: object}>,
 *  Array.<string>): Array.<object>, checks: Array.<string>}>}
 */
const EXPRESSION_LINTERS = [
  {run: lintByAxis, checks: axisChecks},
  {run: lintByNamespaceAxis, checks: namespaceAxisChecks},
  {run: lintByNodeSet, checks: nodeSetChecks},
  {run: lintByCount, checks: countChecks},
  {run: lintByStringLength, checks: stringLengthChecks},
  {run: lintByName, checks: nameChecks},
  {run: lintByTranslate, checks: translateChecks},
  {run: lintByDoubleNegation, checks: doubleNegationChecks},
  {run: lintByBooleanCall, checks: booleanCallChecks},
  {run: lintByPredicatePosition, checks: predicatePositionChecks},
  {run: lintByFormat, checks: formatChecks},
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
 * Deleting incorrect substring-suppressions from array of arguments
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {Array.<string>} - Normalizing list of suppressions
 */
const validatedSuppressions = function(suppressions) {
  for (const sup of suppressions) {
    if (!CHECKS.some((check) => check.includes(sup))) {
      logger.warn(
        `Check with substring '${sup}' does not exist. ` +
        `Delete this '--suppress' or use another one.`,
      )
    }
  }
  if (suppressions.some((sup) => sup === '')) {
    logger.warn(
      'Empty suppress is incorrect. ' +
      'Delete this "--suppress" or use another one.',
    )
    suppressions = suppressions.filter((sup) => (sup) !== '')
  }
  return suppressions
}

/**
 * Returns all .xsl files paths depending on provided path.
 * @param {string} pth - Path to a file or directory holding .xsl files
 * @return {Array.<string>} - Array of .xsl files paths
 */
const xsls = function(pth) {
  let files
  if (fs.statSync(pth).isDirectory()) {
    files = allFilesFrom(pth)
  } else {
    files = [pth]
  }
  return files.filter((file) => file.endsWith('.xsl'))
}

/**
 * Whether a file matches any exclusion glob, compared as a path relative to the
 * configuration's base directory in posix form so the patterns stay portable.
 * @param {string} file - Absolute path of a stylesheet
 * @param {Array.<string>} patterns - Exclusion globs from the configuration
 * @param {string} base - Directory the globs resolve against
 * @return {boolean} - True when the file is excluded
 */
const excluded = function(file, patterns, base) {
  const relative = path.relative(base, file).split(path.sep).join('/')
  return patterns.some((pattern) => minimatch(relative, pattern))
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
 * Lint stylesheet sources and return the defects, without touching the
 * filesystem, printing output, or exiting — the reusable core the command line
 * wraps and an editor or LSP can call in-process. Each defect carries
 * `{name, severity, message, file, line, pos}` and, when fixable, a `fix`;
 * apply fixes with `fixed` (re-exported alongside this). Inline
 * `xslint-disable` directives in each source's content are honored.
 * @param {Array.<{file: string, content: string}>} sources - Raw stylesheets
 * @param {{suppress: Array.<string>, overrides: {[check: string]: string}}}
 *  options - Check-name substrings to skip, and per-check severity re-grades
 * @return {Array.<object>} - The defects that survive suppression
 */
const lint = function(sources, {suppress = [], overrides = {}} = {}) {
  const suppressions = validatedSuppressions(suppress)
  const {corpus, defects: malformed} = validateXsls(sources, suppressions)
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
  }
  const directives = new Map(
    sources.map((source) => [source.file, directivesFrom(source.content)]),
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
    for (const stale of unused(list, found)) {
      logger.warn(`Unused xslint-disable directive at ${file}:${stale.line}`)
    }
  }
  return defects.filter(
    (defect) => !suppresses(directives.get(defect.file), defect),
  )
}

/**
 * Entry point for the command line.
 * @param {Array.<string>} pths - Files or directories with .xsl to lint
 * @param {{
 *  logLevel: string,
 *  quiet: boolean,
 *  suppress: Array.<string>,
 *  maxWarnings: number|undefined,
 *  config: string|undefined,
 *  format: string,
 *  fix: boolean|undefined,
 *  fixDryRun: boolean|undefined,
 *  fixSuggestions: boolean|undefined
 * }} options - CLI options
 */
const xslint = function(pths, options) {
  logger.setLevel(leveled(options.quiet, options.logLevel))
  const config = configFrom(options.config)
  if (options.quiet == null && options.logLevel == null) {
    logger.setLevel(leveled(config.quiet, config.logLevel))
  }
  const disabled = []
  const overrides = {}
  for (const [pattern, severity] of Object.entries(config.rules)) {
    const matched = CHECKS.filter((check) => minimatch(check, pattern))
    if (matched.length === 0) {
      logger.warn(`Rule '${pattern}' in configuration does not exist`)
    }
    for (const check of matched) {
      if (severity === 'off') {
        disabled.push(check)
      } else {
        overrides[check] = severity
      }
    }
  }
  const maxWarnings = options.maxWarnings ?? config.maxWarnings ?? -1
  logger.info(`Directories and files to process: ${pths.join(', ')}`)
  pths = pths.map((pth) => path.resolve(process.cwd(), pth))
  let stylesheets = []
  for (const pth of pths) {
    if (!fs.existsSync(pth)) {
      logger.warn(`File or directory ${pth} does not exist`)
    } else {
      stylesheets = [...stylesheets, ...xsls(pth)]
    }
  }
  stylesheets = stylesheets.filter(
    (file) => !excluded(file, config.exclude, config.base),
  )
  logger.debug(`Found ${stylesheets.length} .xsl files to process`)
  const sources = stylesheets.map((stylesheet) => ({
    file: stylesheet,
    content: fs.readFileSync(stylesheet, 'utf-8'),
  }))
  let reported = lint(sources, {
    suppress: [...options.suppress, ...disabled],
    overrides: overrides,
  })
  if (options.fix || options.fixDryRun || options.fixSuggestions) {
    /**
     * @todo #571:60min Fix over several passes, until a pass changes nothing.
     *  A fix that `fixer.js` skips for overlapping another is never applied
     *  here, so `--fix` under-delivers and then reports a defect the winning
     *  fix has already removed from the file. Re-lint the rewritten contents
     *  and fix again, capped at ten passes, stopping early when a pass
     *  reproduces the content of the pass before last, the way ESLint and
     *  RuboCop both reach a fixpoint without looping forever over two checks
     *  that undo each other.
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
  logger.info(`Processed files: ${stylesheets.length}`)
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
    process.exit(1)
  }
}

module.exports = xslint
module.exports.lint = lint
module.exports.fixed = fixed
