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
const {lintByOutput, names: outputChecks} =
  require('./linters/output-linter')
const {lintByParameter, names: parameterChecks} =
  require('./linters/parameter-linter')
const {lintByElement, names: elementChecks} =
  require('./linters/element-linter')
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
 * Two strings ranked by code unit, the order `Array.prototype.sort` gives with
 * no comparator at all, rather than `localeCompare`, whose answer belongs to
 * the machine's locale and so cannot underlie a report committed once and
 * diffed on every runner (#638).
 * @param {string} one - A string
 * @param {string} two - Another string
 * @return {number} - Negative, zero or positive, as a comparator answers
 */
const compared = function(one, two) {
  return Number(one > two) - Number(one < two)
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
  ).sort(ranked)
}

/**
 * Entry point for the command line.
 * @param {Array.<string>} pths - Files or directories with .xsl to lint
 * @param {object} options - CLI options: `logLevel`, `quiet`, `suppress`,
 *  `maxWarnings`, `config`, `format`, `fix`, `fixDryRun`, `fixSuggestions`
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
    process.exitCode = 1
  }
}

module.exports = xslint
module.exports.lint = lint
module.exports.fixed = fixed
module.exports.STAGES = STAGES
