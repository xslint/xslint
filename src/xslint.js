/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Orchestrates discovery, config, staging, output; exports the pure `lint`
 * (package `main`), `fixed`, and `STAGES` — every linter the pipeline runs,
 * named by its module and paired with what it is handed, derived from
 * `LINTERS`/`EXPRESSION_LINTERS` rather than written out beside them so the
 * speed gate cannot be measuring a list the run has moved on from.
 *
 * `lint` sorts what it hands back, by `ranked`: the file, then the line, the
 * column, and the check that found it. Nothing about the run decides the order
 * any more — not the order `allFilesFrom` handed the stylesheets over in, nor
 * the order the linters happen to be wired in — which is what a report
 * committed once and diffed against every night needs (#638). It is the
 * **report** that is sorted and not the walk, deliberately: readdir answers in
 * code-unit order on APFS already, so no fixture written here could turn red
 * on a walk left unsorted, where a defect list ordered by stage reorders under
 * any wiring change at all. `compared` ranks two strings the way
 * `Array.prototype.sort` does with no comparator, never `localeCompare`, whose
 * answer belongs to the collation data the runtime carries rather than to the
 * report: it orders letters case-insensitively, so all three committed
 * snapshots come back in a different order under it — TEI at its very first
 * line, `Documentation/param.xsl` behind `bibtex/convertbib.xsl` where code
 * units put it in front, DocBook at its 81st file and line 698, DITA-OT at its
 * 12th file and line 66.
 *
 * Which files a run reads is `SUFFIXES`, the two spellings a stylesheet is
 * named with, asked through `suffixed` and nowhere else. It kept one of them
 * until #924, and the filter runs over a single-element list as readily as
 * over a walk, so naming a `.xslt` on the command line printed `Processed
 * files: 0` and `No defects found` and left with a zero — the same bytes named
 * `.xsl` drawing four defects — where a path that does not exist at least
 * earns a warning. A project spelling its stylesheets that way therefore read
 * a green CI job over a directory nothing in it had been opened, and the word
 * stood nowhere in `README.md`, in `src/`, or in the suite for a user to learn
 * it from. A **named** path matching none of them now earns that warning too,
 * which is what keeps the silence from returning under a third extension; a
 * **walk** stays quiet, having been handed a directory rather than a request,
 * and a word per file that is not a stylesheet would bury a report under a
 * repository's worth of them. A `no-restricted-syntax` selector bans a
 * stylesheet suffix spelled into an `endsWith` or an equality anywhere in the
 * repository, and caught three sweeps over this tree's own fixtures on first
 * contact: `test/grammar-corpus.test.js`, which claims every expression the
 * repository carries, and `test/tiers.test.js` and `test/fixer.deep.test.js`,
 * both over the fix fixtures — every one of which would have missed such a
 * file exactly as discovery did. What the selector asks is whether a string
 * *ends* in one of the two, never whether it spells one alone, and the third
 * sweep is the reason: it read `.fixed.xsl` whole, a composite an anchored
 * pattern walks straight past, so the gate written against #924 carried #924's
 * own blind spot until the anchor came off. Those two mark a fixed stylesheet
 * `.fixed.` in front of the suffix rather than as one of them, so the marker
 * holds under either spelling. What the rows asserting all this must not do is
 * take the list from the code: derived from `SUFFIXES`, the row for a suffix
 * went away with the suffix, so the one mutation they exist to catch left the
 * suite green. They spell the two out, and a gate holds the two lists to each
 * other from both sides.
 *
 * Which directories a run *never* opens is the other half of that, and it
 * is the walk that answers rather than the configuration. `allFilesFrom`
 * keeps a floor of its own, `SEALED` in `src/helpers.js`: a directory named
 * `.git` or `node_modules` is not opened whatever it was asked for, neither
 * holding a stylesheet anybody wrote. Beside it `sheets` hands the walk
 * `pruned`, so a directory the configuration's `exclude:` covers whole is not
 * descended either — where until #923 every pattern was read after the walk
 * had already paid for what it covers, `excluded` being a filter over the
 * list and not a prune of the walk. Two checkouts of different shape measure
 * the two halves. This one is the floor's: 430,081 of the 466,770 entries a
 * walk visits here stand inside a `.git` or a `node_modules`, 92% of it, and
 * the walk costs 179 milliseconds rather than the 3.7 seconds it cost reading
 * them. The eo repository is the pattern's: 612,209 entries for the 5,035
 * stylesheets it reports, seconds spent before a byte of XSL was read, of
 * which the floor takes 4,690 and the two patterns eo already configures
 * 50,495 more, because 595,096 of those entries stand inside a gitignored
 * `.claude`, 52 worktrees of the same checkout. One further line of `exclude:`
 * covering that name at any depth takes the run to 10,971 entries and tens of
 * milliseconds, and as a post-walk filter the same line buys nothing: that is
 * what a prune is worth over a filter, and why the half a user can reach for
 * is the pattern rather than the floor. A third answer stands beside those
 * two since #929, and it is neither the walk's nor the configuration's: the
 * project's own `.gitignore` files, read as the walk passes each directory,
 * which refuse that `.claude` with no line of configuration at all — the run
 * over eo reported 5,031 stylesheets for a checkout holding 123. What one
 * says, and what is deliberately left to git, is at the top of
 * `src/gitignore.js`.
 *
 * A prune must not change *what* is reported, only what a run pays to report
 * it, so `pruned` accepts one shape: `COVERING`, the trailing `/**` that
 * covers every file the walk would hand back from under the directory. A bare
 * `dir` is refused deliberately — it excludes no `dir/sheet.xsl`, so pruning
 * on it would take a reported stylesheet out of the report — and the
 * file-level `excluded` therefore stays exactly where it stood.
 *
 * Two shapes beside the bare one made the prune a second opinion rather than
 * an optimisation, and both came from the matcher rather than from the walk. A
 * glob passes over a name opening with a dot unless it is told not to, so the
 * tail stripped off `shut` matched the directory while the pattern itself
 * matched no file under a dotted segment of it: the walk skipped `shut`,
 * `excluded` kept `shut/.hidden/c.xsl`, and the run reported one stylesheet
 * where the same configuration read as a filter reported two. Only one of
 * those readings can be what a pattern covering a whole directory means, and
 * it is the wider one, so `DOTTED` stands on both matches and a dotted name
 * is a directory like any other here. What that is worth is eo's own two
 * lines, which took 1,452 entries while a dotted segment stopped them and take
 * 50,495 now, the `.claude` they could not reach into holding 52 copies of
 * everything they name. The other shape is a leading `!`, which excludes what
 * a pattern does *not* name: stripping the tail off one leaves a mark matching
 * every directory but the one named, so it pruned nearly the whole walk while
 * `excluded` reported precisely what stood under the directory it spared.
 * `NEGATED` refuses it outright, a pattern of that shape covering no directory
 * whatever tail it wears.
 *
 * A gate in `test/xslint.deep.test.js` holds the pair from the sound side: no
 * row `pruned` accepts may leave a stylesheet under it that `excluded` keeps.
 * What no report can show is the prune itself, a directory read and dropped
 * saying precisely what one never opened says, so the two tests that pin it
 * reach for the only observables there are — a predicate recording what the
 * walk asked about, and a directory `chmod`ped unreadable, which every run
 * before #923 descended and died on. And a floor is worth what it says only
 * while there is one walk to keep it, so `test/walk.deep.test.js` refuses a
 * `readdir` anywhere else in `src/`.
 *
 * Whether a pattern ever excluded anything is the run's to say since #951. A
 * rule name matching no check is warned on before the walk starts, while a
 * glob matching nothing at all was handed to the filter and counted by
 * nobody — so a directory renamed out from under an `exclude:` read as a run
 * still honouring it. `reaching` counts at both doors rather than at the
 * filter alone, because a `dir/**` that prunes correctly matches zero
 * *files*: the walk never enumerates them, so a file-only counter would name
 * every working directory-covering pattern there is. What it will not say is
 * anything about a run that walked no directory — `xslint one.xsl` excludes
 * nothing by anything, and the pre-commit hook handing over the files it
 * changed would otherwise carry a line per pattern, every run, about a
 * configuration written for the whole tree.
 *
 * The exit code it sets is `process.exitCode` and never `process.exit`, which
 * ends the process where it stands and abandons every write the kernel has not
 * taken: node's stdout is asynchronous to a pipe on POSIX — synchronous to a
 * file, to a terminal, and to a pipe on Windows — so whether the report
 * arrived whole depended on how fast the other end read it. Twenty stylesheets
 * draw 720 defects here, 165,500 bytes of report: a file or a terminal takes
 * all of it, a shell pipe whose reader stalls for two seconds takes 65,492
 * bytes, and the socket `spawn` hands a child takes none at all. The exit code
 * was right in each of those, so nothing announced the loss (#767). A
 * `no-restricted-syntax` selector bans the call across the repository, nothing
 * here having a use for it — the `catch` around the parse in `src/index.mjs`
 * sets the same field. What pins it is a pair of runs whose reader stays
 * paused until stderr says how many defects were found, counting the report's
 * lines against that number: one report wider than the pipe and one narrower,
 * since how wide a pipe the host gives is what decides which of the two shapes
 * a run of this suite meets. The wide one leaves the run writing into a pipe
 * nobody is emptying, which is the write `process.exit` abandons and the whole
 * of what #767 is about — put back, it reports 312 of the 760 lines it
 * counted. The narrow one is taken whole before the reader looks, so the run
 * is over and the hazard is node's own rather than this project's: one
 * `process.nextTick` after a child exits, `flushStdio` resumes every readable
 * stdio stream of it, deliberately, so the stream can reach eof, and an
 * untouched one is read and thrown away. A stalled reader must therefore own
 * the data rather than leave it for that flush, which is `test/helpers.js`'s
 * business and what the narrow row pins. Twenty stylesheets were the whole of
 * the test until #822, so its verdict stood on the host's socket buffer and
 * not on the run: those twenty are 147,620 bytes of report now, which fits
 * whatever rultor's docker container gives, so the run finished first, node
 * discarded the report, and eleven merges in a row read `-0` on a commit six
 * GitHub runners passed.
 *
 * `NURSERY` is what `--stable` withholds, read off `checks.json` rather than
 * written out here, each check naming the open issue that keeps it out (#581).
 * Three things about the gate are deliberate, and each is a channel kept apart
 * from one that already existed. It matches a **whole name**, where
 * `suppressed` matches a substring and `unused-function` stands inside
 * `unused-function-template-parameter`, which is settled. It exempts a name
 * the config grades **verbatim** and never one a glob reached, which is what
 * `admitted` is for beside `overrides`: that map is keyed by expanded names,
 * so `'*': warning` would have exempted every one of them silently, a pattern
 * about severity being no vouch for a check. It defaults to `overrides`'s
 * keys, verbatim for an embedder calling `lint`, and a glob run says which of
 * the checks it graded stay withheld. And it stands **after** the directive
 * pass: a defect withheld in front of it is a defect the directive over it
 * never suppressed, so `--stable` would call that directive unused and tell
 * the author to delete the one line keeping the file quiet under the other
 * tier. Since #851 the tier holds nothing: every issue reporting one of the
 * sixty-eight checks wrong about code a processor accepts is closed, which is
 * the release bar rather than a claim any of them is finished. What a member
 * costs a run is therefore reached by handing `lint` a `nursery` of its own,
 * an option beside `admitted`, since the tree's own holds no name to exercise
 * it with and the gating loop is where the CLI used to keep a second copy of
 * itself — it named the withheld checks a glob had graded from out there, one
 * tier spelled in two places, and the copy is gone.
 */

const path = require('path')
const fs = require('fs')
const {allFilesFrom, slashed, subsetsOf} = require('./helpers')
const {ignoring} = require('./gitignore')
const {parted} = require('./source')
const {SUGGESTION} = require('./checks')
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
 * The checks a stable run withholds, each paired with the open issue reporting
 * it wrong — read off the checks themselves, where a `nursery` mark names that
 * issue, so the tier is the tree's answer rather than a list kept beside it,
 * and holds nothing wherever every such issue is closed. A whole name and
 * never a substring, which is what `suppress` matches (#581, #851).
 * @type {Map.<string, string>}
 */
const NURSERY = new Map(
  Object.values(kinds).flatMap((kind) => Object.entries(kind))
    .filter(([, check]) => Object.hasOwn(check, 'nursery'))
    .map(([name, check]) => [name, check.nursery]),
)

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
 * The checks a run narrowed to some substrings reports, every check where it
 * names none. A choice naming no check is warned about, since a typo would
 * otherwise narrow the run to nothing and read as a clean report (#1030).
 * @param {Array.<string>} only - Substrings of the names chosen
 * @return {Array.<string>} - Names of the checks chosen
 */
const chosenOf = function(only) {
  for (const choice of only) {
    if (!CHECKS.some((check) => check.includes(choice))) {
      logger.warn(
        `Check with substring '${choice}' does not exist. ` +
        `Delete this '--only' or use another one.`,
      )
    }
  }
  let chosen = CHECKS
  if (only.length > 0) {
    chosen = CHECKS.filter(
      (check) => only.some((choice) => check.includes(choice)),
    )
  }
  return chosen
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
 * @param {Array.<{file: string, content: string, subsets: Map}>} sources -
 *  Raw stylesheets as read, a byte order mark held aside by `parted`, and
 *  the files their parameter entities name, read by the caller (#1010)
 * @param {{suppress: Array.<string>, overrides: {[check: string]: string},
 *  stable: boolean, admitted: Array.<string>, nursery: Map, only: Array}}
 *  options - Skips, re-grades, the tier gate, its exemptions and marks, choices
 * @return {Array.<object>} - The defects that survive suppression
 */
const lint = function(
  sources,
  {
    suppress = [], overrides = {}, stable = false,
    admitted = Object.keys(overrides), nursery = NURSERY, only = [],
  } = {},
) {
  const chosen = chosenOf(only)
  const suppressions = [
    ...validatedSuppressions(suppress), ...unchosenOf(chosen),
  ]
  const read = sources.map((source) => ({
    file: source.file, content: parted(source.content).text,
    subsets: source.subsets ?? new Map(),
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
    for (const stale of unused(list, found)) {
      logger.warn(`Unused xslint-disable directive at ${file}:${stale.line}`)
    }
  }
  const gated = new Set()
  if (stable) {
    for (const [name, issue] of nursery) {
      if (!admitted.includes(name)) {
        gated.add(name)
        if (overrides[name]) {
          logger.warn(
            `Rule '${name}' stays withheld under the stable tier, ` +
              `a pattern grading it having named no check: ${issue}`,
          )
        }
      }
    }
  }
  return defects.filter(
    (defect) => chosen.includes(defect.name) && !gated.has(defect.name) &&
      !suppresses(directives.get(defect.file), defect),
  ).sort(ranked)
}

/**
 * Entry point for the command line.
 * @param {Array.<string>} pths - Files or directories with .xsl to lint
 * @param {object} options - CLI options: `logLevel`, `quiet`, `suppress`,
 *  `maxWarnings`, `config`, `format`, `stable`, `only`, `fix`, `fixDryRun`,
 *  `fixSuggestions`
 */
const xslint = function(pths, options) {
  logger.setLevel(leveled(options.quiet, options.logLevel))
  const config = configFrom(options.config)
  if (options.quiet == null && options.logLevel == null) {
    logger.setLevel(leveled(config.quiet, config.logLevel))
  }
  const disabled = []
  const overrides = {}
  const admitted = []
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
        if (check === pattern) {
          admitted.push(check)
        }
      }
    }
  }
  const maxWarnings = options.maxWarnings ?? config.maxWarnings ?? -1
  logger.info(`Directories and files to process: ${pths.join(', ')}`)
  pths = pths.map((pth) => path.resolve(process.cwd(), pth))
  const reach = reaching(config.exclude, config.base)
  let stylesheets = []
  for (const pth of pths) {
    if (!fs.existsSync(pth)) {
      logger.warn(`File or directory ${pth} does not exist`)
    } else if (!fs.statSync(pth).isDirectory() && !suffixed(pth)) {
      logger.warn(
        `File ${pth} was not read, ` +
          `a stylesheet being named ${SUFFIXES.join(' or ')}`,
      )
    } else {
      stylesheets = [...stylesheets, ...sheets(pth, reach)]
    }
  }
  stylesheets = stylesheets.filter((file) => !reach.file(file))
  for (const pattern of reach.unreached()) {
    logger.warn(`Exclusion '${pattern}' in configuration excluded nothing`)
  }
  logger.debug(`Found ${stylesheets.length} stylesheets to process`)
  const sources = stylesheets
    .map((stylesheet) => [stylesheet, fs.readFileSync(stylesheet, 'utf-8')])
    .map(([stylesheet, content]) => ({
      file: stylesheet,
      content: content,
      subsets: subsetsOf(stylesheet, content),
    }))
  const stable = options.stable ?? config.stable ?? false
  let only = config.only
  if (options.only?.length > 0) {
    only = options.only
  }
  let reported = lint(sources, {
    suppress: [...options.suppress, ...disabled],
    overrides: overrides,
    stable: stable,
    admitted: admitted,
    only: only,
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
module.exports.SUFFIXES = SUFFIXES
module.exports.suffixed = suffixed
module.exports.excluded = excluded
module.exports.pruned = pruned
