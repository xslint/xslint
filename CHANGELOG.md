# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries for releases before this file was introduced record their npm
publication date only; detailed notes begin with the Unreleased section.

## Unreleased

- Move the `starts-with-double-slash` fix behind `--fix-suggestions`. Dropping
  the leading `//` off a `@match` keeps the matched nodes but not the default
  priority — a pattern with a `/` step is 0.5, a lone name test 0 — so a plain
  `--fix` could hand a conflict to a rule the template used to outrank. A
  pattern of nothing but the slashes now gets no fix, since emptying it would
  trade one broken pattern for another (#583).

- Add the `redundant-double-negation` check: `not(not(x))` is a redundant
  double negation — exactly `boolean(x)`. Reported in any `@test`/`@select`,
  with a safe `--fix` that rewrites it to `boolean(x)` (always equivalent). An
  outer `not(...)` whose content is more than a lone inner `not(...)`, and a
  custom `my:not(...)`, are left alone (#366).

- Make the degenerate-`xsl:choose` checks disjoint, so each fires once with
  the right advice: `empty-choose` on no `xsl:when`, `use-single-option-for-
  choose` on exactly one `xsl:when` and no `xsl:otherwise` (use `xsl:if`), and
  `use-choose-without-otherwise` on two or more `xsl:when` and no
  `xsl:otherwise` (add one). Previously `use-single-option-for-choose` fired
  on any one-child `choose` — including a lone `xsl:otherwise`, where its
  advice was nonsense and it overlapped with `empty-choose` (#480).

- Add the `param-after-content` check: an `xsl:param` that follows real
  content in its `xsl:template` or `xsl:function` is invalid XSLT that XML
  well-formedness never catches (only other params and an `xsl:context-item`
  may precede it). Report-only, since moving the param up is structural
  (#367).

- Add the `sort-not-first` check: an `xsl:sort` that follows other content in
  its `xsl:for-each` or `xsl:apply-templates` is invalid and silently ignored
  by some processors. Report-only, since moving it to the front is structural
  (#372).

- Add the `empty-choose` check: an `xsl:choose` with no `xsl:when` is
  degenerate — XSLT requires at least one, and a `choose` holding only an
  `xsl:otherwise` is a wrapper that always runs. Report-only, since the fix
  (add a `when`, or drop the `choose`) is a judgement call (#374).

- Add the `otherwise-not-last` check: an `xsl:otherwise` followed by another
  branch is invalid — it is the default and must come last in its
  `xsl:choose`. Report-only, since reordering the branches is structural
  (#373).

- Add the `when-or-otherwise-outside-choose` check: an `xsl:when` or
  `xsl:otherwise` whose parent is not `xsl:choose` is invalid XSLT that XML
  well-formedness never catches. Report-only — wrapping the branch in an
  `xsl:choose` or rewriting an `xsl:when` as an `xsl:if` is a judgement call,
  not one mechanical edit (#368).

- Add the `redundant-import` check: the same module `xsl:import`ed or
  `xsl:include`d more than once within one stylesheet's own list is flagged (a
  warning) at the second and later references, with a safe `--fix` that deletes
  the duplicate line (the module stays imported by the first reference). Hrefs
  are resolved against the importing file's directory, so two spellings of the
  same file count as one, and the target need not be in the corpus — importing
  the same external library twice is redundant too. A self-import or cross-file
  cycle is a different fault, left to `circular-import` (#467).

- Add the `circular-import` check and an import-graph foundation
  (`src/import-graph.js`): resolve every `xsl:import`/`xsl:include` `@href`
  against the importing file's directory, build the dependency graph over the
  corpus, and flag each import that closes a cycle — a stylesheet that pulls in,
  directly or through a chain, one that pulls it back, or imports itself. A
  static XSLT error, reported as such. An href resolving outside the linted set
  is external and never part of a cycle, so a partial corpus cannot raise a
  false positive. First slice of the import-graph work (#210).

- Make `text-outside-xsl-text` fixable: `--fix-suggestions` wraps loose literal
  text inside an instruction in `xsl:text` (`<xsl:if test="a">hello</xsl:if>`
  becomes `<xsl:if test="a"><xsl:text>hello</xsl:text></xsl:if>`). A suggestion,
  and offered only when the instruction holds a single non-whitespace text node,
  since text on both sides of a child element needs several wraps that one edit
  cannot make (#459).

- Make `confusing-variable-and-node` fixable: `--fix-suggestions` prepends `$`
  to a bare variable name used as a node selector in an `xsl:apply-templates`
  `@select` (`select="items"` becomes `select="$items"`). A suggestion, since it
  assumes the author meant the variable rather than a child element (#458).

- Make `select-starts-with-double-slash` fixable: `--fix-suggestions` anchors
  the leading `//` of a `@select` as `.//` (`select="//title"` becomes
  `select=".//title"`). A suggestion, since it changes behaviour from an
  absolute scan to a relative one and `.//` is one of several valid anchors
  (a specific path is often better) (#457).

- Make `incorrect-use-of-boolean-constants` fixable: `--fix-suggestions`
  replaces the string test `'true'`/`'false'` with `true()`/`false()`. A
  suggestion, not a safe fix, because `'false'` is a non-empty string that is
  always true, so the rewrite changes the test's truth value — which is the
  bug it flags (#456).

- Make `starts-with-double-slash` fixable: `--fix` drops the redundant leading
  `//` of a template's `@match` (`match="//para"` becomes `match="para"`). It is
  a safe fix, not a suggestion, since a match pattern is already unanchored and
  the shortened pattern selects the same nodes (#455).

- Add the `leaking-result-namespace` check: a namespace prefix a stylesheet
  declares only for its own logic — `xs` for a sequence type, a helper `my`/`eo`
  called from a `select` — is copied into the serialized output by any literal
  result element, unless it is listed in `exclude-result-prefixes`. The check
  flags such a prefix, with a `--fix-suggestions` that adds it to
  `exclude-result-prefixes` (inserting the attribute or appending to it, and
  only when a single prefix leaks). It skips text-output stylesheets,
  `#all`/already-excluded and extension prefixes, and any prefix a result
  element genuinely uses, and complements `redundant-namespace-declarations`
  (a prefix used nowhere) rather than overlapping it, and catches the class of
  regression seen in objectionary/eo#6079 (#453).

- Add the `unreachable-function` check and narrow `unused-function` to suit.
  `unused-function` now flags only a function whose name appears in no call at
  all; a function that *is* called, but only from within a recursion cycle that
  nothing enters — a self-loop, or a `my:even`/`my:odd` pair — is dead code the
  new `unreachable-function` reports, following the call graph from calls that
  sit outside every function body. Previously such cycles slipped through, each
  reference propping the other up (#175).

- Add the `not-creating-attribute-correctly` check: an `xsl:attribute` with a
  static name on a literal result element, whose value is simple (a single
  `xsl:value-of`, text, or empty), can be written inline as a literal attribute
  (an AVT for a computed value). Warning only — the inline rewrite is structural
  and waits on the full-fidelity parser (#228). `xsl:element`/`xsl:copy` parents,
  computed names, and `xsl:choose` values are left alone (#438).

- Add the `translate-for-case` check: in an XSLT 2.0/3.0 stylesheet, a
  `translate(x, 'A..Z', 'a..z')` (or the reverse) that folds case over the ASCII
  alphabet is flagged, with a `--fix-suggestions` that rewrites it to
  `lower-case(x)` or `upper-case(x)`. A suggestion because those fold all of
  Unicode, not just ASCII. Fires only in 2.0/3.0, since 1.0 has no such
  function; any other `translate` is left alone (#440).

- Add the `name-compared-to-string` check: `name()`/`local-name()` compared with
  a string literal (either operand order) is prefix-fragile and slower than a
  node test. A `--fix-suggestions` rewrites `name() = 'x'` → `self::x`,
  `!= 'x'` → `not(self::x)`, and `local-name() = 'x'` → `self::*:x` (the
  wildcard, so 2.0/3.0 only); it is a suggestion because it shifts lexical-name
  to expanded-name matching. Only a comparison over the current node with a
  valid name is rewritten (#439).

- Add the `select-starts-with-double-slash` check: a `select` whose XPath begins
  with `//` scans the whole document from the root every time it runs — a real,
  repeated scan, unlike the merely redundant leading `//` in a match pattern.
  Warning only, since the right anchor (`.//` or a specific path) depends on
  intent. An inner `//`, one inside a string, or one reached through a variable
  is left alone (#435).

- Add the `string-length-compared-to-zero` check: `string-length(X)` compared
  with `0` to test emptiness (in either operand order, inside larger boolean
  expressions) is flagged, with a `--fix` that rewrites it to `X != ''` or
  `X = ''` when `X` is a simple operand. A genuine length check such as
  `string-length(X) > 1` is left alone, and a union argument is reported but
  left for a human. The lexer helpers `masked`/`closes` are extracted to
  `src/expressions.js`, shared by the count, node-set, and string-length
  linters (#437).

- Add the `count-compared-to-zero` check: `count(X)` compared with `0` to test
  existence (`> 0`, `= 0`, `!= 0`, `>= 1`, `<= 0`, `< 1`, in either operand
  order) is flagged, with a `--fix` that rewrites it to `exists(X)` or
  `empty(X)`. It works inside larger boolean expressions and leaves a genuine
  count such as `count(X) > 1` alone (#436).

## 0.0.14 - 2026-07-28

- Make the `starts-with-double-slash` and `use-double-slash` messages honest.
  They blamed a "document scan" that a match pattern never performs; they now
  say a leading `//` is redundant and an inner `//` matches at any depth,
  matching the motives corrected earlier (#423).

- Drop the `not-using-schema-types` check. It fired on a 2.0/3.0 stylesheet that
  used no `xs:` type anywhere — an arbitrary "use at least one type" rule that a
  single token type silenced and that flagged perfectly valid untyped
  stylesheets. A precise per-binding replacement is parked in #430 (#423).

- Refresh the real-code proof after the check audit: 1,974 findings across 22
  checks on the same 70 DocBook/TEI/DITA files (was 2,019 across 23), and bump
  the stale install-example version in the README (#423).

## 0.0.13 - 2026-07-28

- Drop the `unsorted-imports` check. Ordering `xsl:import` elements alphabetically
  can change import precedence — a later import overrides an earlier one on a
  template conflict — so advising that reorder risked changing behavior (#423).

- Rework the size and count checks into one coherent band, split by node type so
  they never double-report (#423):
  - `too-many-small-templates` → **`too-many-templates`**: fire when a stylesheet
    declares ten or more `xsl:template`, whatever their size, since a file with
    that many templates is hard to read (breaking: the `--suppress`/config name
    changes).
  - `function-template-complexity` → **`function-complexity`**: look only at
    `xsl:function` (more than 50 elements); a large template is a different smell
    (breaking rename).
  - `monolithic-design` → **`oversized-template`**: fire on a single
    `xsl:template` holding more than 100 XSLT elements, rather than on any
    one-template stylesheet — a small one-template sheet is fine, an undecomposed
    hundred-element one is not (breaking rename).

- Rewrite four check motives to argue their real rationale instead of a false
  one. `missing-id-in-stylesheet` and `not-using-output` are consistency rules,
  not technical necessities — an `id` does nothing on a standalone stylesheet,
  and the default output method is defined by the spec rather than left
  implementation-defined. `use-double-slash` and `starts-with-double-slash`
  are about over-broad, under-specific match patterns, not a "full document
  scan" that a match pattern never performs (#423).

## 0.0.12 - 2026-07-27

- Fix a family of false positives surfaced by linting real-world XSLT
  (DocBook-XSL, TEI, DITA-OT, and objectionary/eo):
  - `invalid-xpath-expression` no longer rejects XPath 1.0 numeric coercion
    such as `substring-before(...) - 1`, nor the `namespace::` axis (#396,
    #402).
  - `malformed-stylesheet` tolerates internal-subset entity declarations, and
    declared entities are resolved before linting (#395, #403).
  - `unused-function` and `unused-variable` now follow usage across the whole
    corpus, so a definition in a `_funcs.xsl`/`_specials.xsl` library used from
    an importing stylesheet is no longer flagged (#407).
  - `incorrect-use-of-boolean-constants` fires only on a bare boolean constant
    in an `xsl:if`/`xsl:when` test, not on string comparisons or output (#409).
  - `empty-content-in-instructions` leaves an empty `xsl:when`/`xsl:otherwise`
    alone; only `xsl:if`/`xsl:for-each` are flagged (#411).
  - `stylesheet-has-no-templates` and `not-using-output` exempt library modules
    that have no templates (#412, #414).
  - `null-output-from-stylesheet` no longer flags an empty node-suppressing
    template (#413).

- Add a `.pre-commit-hooks.yaml` so xslint can run as a pre-commit hook.

- Turn the documentation-site index into a landing page and add a "proven on
  real code" section.

## 0.0.11 - 2026-07-27

- Move the project to the `xslint` GitHub organization; the repository,
  homepage, and documentation-site URLs now point at `github.com/xslint`.

## 0.0.10 - 2026-07-26

- Expose a programmatic API: `lint(sources, {suppress, overrides})` returns the
  defects for in-memory `{file, content}` sources without reading files,
  printing, or exiting, and `fixed` applies the fixes. The package `main` now
  points at this API (the CLI bin stays `src/index.mjs`), so editors and the
  planned LSP server (#336) can embed xslint instead of shelling out. The CLI
  is now a thin wrapper over `lint` (#336).

- Add three more `--fix-suggestions`, each a `src/fixers.js` registry entry:
  `output-method-xml` (switch `method="xml"` to `"html"`),
  `missing-version-in-stylesheet` (declare `version="1.0"`), and
  `mode-or-priority-without-match` (delete the orphan attribute, when exactly
  one of `mode`/`priority` is present) (#334).

- Add a suggestion tier to `--fix`. A fix marked `suggestion` is opinionated —
  it changes behavior, removes code, or is one of several valid corrections —
  so `--fix` leaves it and only the new `--fix-suggestions` applies it. A
  declarative xpath rule can now carry a fix through `src/fixers.js` without
  becoming a code-based linter; `using-disable-output-escaping` is the first
  suggestion (the attribute is deleted). A run without `--fix` now reports how
  many defects each option would fix (#334).

- Make `use-node-set-extension` fixable by `--fix`: it is now a code-based
  check (`src/node-set-linter.js`) that reports one defect per `node-set()`
  call in a `@select` of an XSLT 2.0/3.0 stylesheet, with a fix that unwraps it
  (`exsl:node-set($x)` → `$x`). It masks string and comment spans before
  matching, so a `node-set(` inside a literal is never flagged (#334).

- Make `redundant-namespace-declarations` fixable by `--fix`: it is now a
  code-based check (`src/namespace-linter.js`) that reports one defect per
  namespace prefix declared on the stylesheet but used nowhere, positioned at
  the declaration, with a fix that deletes it. Detection is unchanged; the now
  unused `xslint:in-scope-prefixes` custom XPath function was removed (#334).

- Make `unabbreviated-axis` fixable by `--fix`: it is now a token-aware check
  (`src/xpath-axis-linter.js`) that reports one defect per verbose axis and
  abbreviates it (`child::x`→`x`, `attribute::x`→`@x`, `parent::node()`→`..`).
  It reads every XPath and pattern attribute, so an axis in a template `match`
  is caught, and points at each occurrence rather than the whole element; a
  `parent::` with any other node test, having no short form, is no longer
  flagged (#334).

- Add a `--fix` mode (`--fix-dry-run` to preview) that rewrites the
  mechanically-fixable defects in place. It covers `redundant-whitespace`
  today: a check-agnostic engine (`src/fixer.js`) applies the `fix` a defect
  carries only when the flagged span still matches, leaving the rest of the
  file byte-for-byte intact (#334).

- Add a scheduled workflow that keeps the `xslint-action` version in the README
  current, opening a PR when the action publishes a new release (#357).

- Enforce a 100-character line length for Markdown (code blocks and tables
  exempt); `CLAUDE.md`, a dense one-line-per-paragraph reference, is exempt
  (#355).

## 0.0.9 - 2026-07-24

- Fix the release workflow: read the changelog for the GitHub Release notes and
  set them with `gh release edit` (falling back to create) rather than failing
  on Rultor's existing release, and stop pushing the changelog to the protected
  `master` — the changelog is now promoted in the pre-tag pull request (#349).

## 0.0.8 - 2026-07-24

- Declare `repository` (so `npm publish --provenance` validates) and a
  `files` allowlist that ships only `src`, keeping `coverage`, tests, and the
  dev-only `patches` out of the published package (#346).

- Publish releases from a GitHub Actions workflow via npm OIDC trusted
  publishing (no token to rotate, with provenance), promoting the changelog and
  cutting a GitHub Release; `@rultor release` still validates, tests, and pushes
  the tag that triggers it (#343).

- Authenticate Codecov uploads with `CODECOV_TOKEN`, so coverage reports upload
  and the badge reflects real coverage (#341).

- Add a `--format github` reporter that prints GitHub Actions workflow
  commands, so findings render as inline annotations on the pull-request diff
  with no SARIF-upload step (#333).

- Evaluate suppression once per run in the per-file XPath linter instead of
  re-checking it for every file, matching the other linters (#331).

- Run the coverage gate in Rultor's merge and release builds, so a drop below
  100% blocks the merge and the release rather than only annotating the pull
  request (#328).

- Type the `TOKENS` map with a non-drifting index signature instead of a
  hand-maintained key-by-key literal that had fallen out of sync (#327).

- Count every `src` file toward the 100% coverage gate (`c8` `all`), so a module
  shipped without a test now fails CI instead of being silently omitted (#322).

- Extend the `node:`-prefix ban from `require` to ESM `import` as well, and use
  bare specifiers in `eslint.config.mjs` (#319).

- Name an out-of-tree file by its absolute path in `json`/`sarif` output rather
  than a `..`-climbing relative path that GitHub code scanning cannot map
  (#320).

- Parse the corpus checks once at module load instead of on every run, matching
  the other linters and validators (#317).

- Send a fatal CLI error's stack trace to stderr instead of stdout, so stdout
  stays clean for defects and machine-readable output (#318).

- Reach 100% statement, branch, function, and line coverage and raise the
  gate from 90% to 100% (the CLI bootstrap `src/index.mjs` is excluded, as it
  already is from mutation testing) (#305).
- Add a project-local ESLint rule that bans a redundant return variable
  (`const x = expr; return x`), so the convention is enforced on new code
  (#310).
- Load the CLI entry as an ES module (`src/index.mjs`) so `commander` — which
  is ESM-only — no longer triggers Node's `ExperimentalWarning` on every run;
  the test harness no longer silences warnings, so it sees what users see
  (#300).
- Report a stylesheet as malformed for any well-formedness problem the XML
  parser reports, not only the fatal ones — an undefined entity or a stray
  `<` no longer slips through — and route the parser's own diagnostics through
  the logger instead of leaking them to the console (#298).
- Assert behavior rather than whole-corpus totals in the end-to-end tests, so
  adding a fixture or a rule no longer breaks an unrelated test (#303).
- Use bare module names in `require` (drop the `node:` prefix) and enforce it
  with an ESLint rule; collapse the duplicate `warn`/`warning` naming in the
  logger and writer (#304).
- Apply `--log-level`/`--quiet` before reading the configuration, rule
  patterns, and suppressions, so a raised level now silences their warnings
  too (#299).
- Color output only for an interactive terminal and honor `NO_COLOR`, so
  redirected or piped output no longer carries raw ANSI escapes (#302).
- Report and ignore `.xslint.yml` values of the wrong type — a non-numeric
  `max-warnings` no longer silently disables the warning gate (#301).
- Add machine-readable output: `--format json` and `--format sarif` (SARIF
  2.1.0, for GitHub code scanning) alongside the default `text` (#260).
- Add inline suppression directives — `xslint-disable-next-line`,
  `xslint-disable-line`, and `xslint-disable-file` (#262), and report a
  directive that suppresses nothing as unused (#288).
- **Breaking:** drop the `template-match-` prefix from every rule name and
  rationalize a few awkward ones, so `--suppress` strings and config `rules`
  keys change accordingly; add a conformance test that enforces rule naming,
  motives, and test packs (#258).
- Add a `.xslint.yml` configuration file — rule severities and globs,
  `exclude`, `max-warnings`, `log-level`, `quiet` — resolved with `--config`
  and walk-up discovery (#261, #282, #283, #284, #285).
- Add c8 coverage measurement with a 90% gate and a Codecov badge (#265).
- Add scheduled Stryker mutation testing (#266).
- Parse each XPath rule once at load instead of once per file (#256).
- Compute each tokenizer probe once per position (#255).
- Apply the schema-type and node-set rules to XSLT 3.0 stylesheets (#259).
- Make the exit code severity-aware and add `--max-warnings` (#264).
- Send logs to stderr and defects to stdout, and add `--quiet` (#263).
- Add round-trip and offset property tests for the tokenizer (#267).
- Point the README badges at this repository (#254).

## 0.0.6 - 2026-06-29

- Published to npm.

## 0.0.5 - 2026-03-26

- Published to npm.

## 0.0.4 - 2026-03-12

- Published to npm.

## 0.0.3 - 2025-01-22

- Published to npm.

## 0.0.2 - 2025-01-22

- Published to npm.

## 0.0.1 - 2025-01-07

- First release to npm.
