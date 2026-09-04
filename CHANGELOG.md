# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries for releases before this file was introduced record their npm
publication date only; detailed notes begin with the Unreleased section.

## Unreleased

- **Breaking:** rename `null-output-from-stylesheet` to
  `template-writes-nothing`, and ask it of every template rather than only a
  `/`-prefixed match, so `--suppress` strings and config `rules` keys change
  with it (#559).

- **Breaking:** rename `variable-or-param-without-name` to
  `missing-or-empty-name` and widen it to all eleven XSLT elements that take
  an `@name`, an empty value counting as a missing one; add
  `missing-or-empty-href` beside it for an `xsl:import` or `xsl:include`
  written without one, which used to crash the run (#838, #597).

- Add the `modern-construct-in-xslt-1` check (error): a construct XSLT 2.0 or
  later introduced, standing in a stylesheet that declares `version="1.0"`,
  is something a 1.0 processor cannot run (#533, #532, #544).

- Add the `malformed-version-in-stylesheet` check (error): a `@version` that
  is not an `xs:decimal` used to disable every version gate in silence, so a
  `version="2"` stylesheet was judged as a versionless one. `2`, `2.0` and
  `2.00` are one version now, and a value nothing can place is reported
  rather than guessed at (#614).

- Add the fixable `redundant-boolean-call` check: a `boolean()` standing
  where nothing but a truth is taken drops its wrapper, so
  `test="boolean(@x)"` becomes `test="@x"`. An operand of a comparison keeps
  it, and so does a predicate, where XPath reads a number as a position
  rather than a truth (#370).

- Add the fixable `predicate-position-literal` check: a positional predicate
  written the long way is shortened, so `item[position() = 1]` becomes
  `item[1]` and `item[position() = last()]` becomes `item[last()]`, the XSLT
  2.0 value comparisons read the same way (#371).

- Judge XPath and patterns with a grammar of this project's own — the XPath
  3.1 expression productions and the restricted set a pattern admits, as
  recursive descent over the positioned lexer — rather than taking a verdict
  from fontoxpath at 3.1 whatever the stylesheet declares.
  `invalid-xpath-expression` answers at the version in force now, a `cast as`
  in a `version="1.0"` sheet included, and a malformed `match` or attribute
  value template is no longer silent. A round-trip proof and an acceptance
  diff against the engine gate it, over every expression this repository
  carries and 14112 nobody wrote, which is what turned up the lexer and
  grammar defects behind it (#677, #678, #679, #680, #732, #708, #731, #249,
  #617, #641, #676, #685, #703, #709, #711, #724, #726, #728, #736, #738,
  #740, #742, #746, #752, #753, #764).

- Report one defect per fault. An expression the XPath validator refuses
  reaches no check at all now, where ten linters used to rescan the corpus
  and report a second defect on the same text: `select="child::"` drew an
  `invalid-xpath-expression` and an `unabbreviated-axis` both, and the advice
  stood on text no processor accepts (#750, #636, #651, #586, #788).

- Read the version in force at the node under judgement rather than at the
  document root. `version` stands on any XSLT element and `xsl:version` on
  any literal result element, each setting the version of its own subtree, so
  a template raised or lowered against its root is judged as itself; a
  simplified stylesheet is read through its `xsl:version` rather than skipped
  by every version gate; and an embedded stylesheet's host root is no longer
  reported as a stylesheet missing one (#603, #608, #618, #702, #544).

- Read every expression a stylesheet carries, and only those. An attribute
  value template's braces, an XSLT 3.0 text value template, a shadow
  attribute (`_select` for `select`) and `xsl:use-when` in the XSLT namespace
  are validated and linted now, where 165 of 451 expressions used to reach
  nothing at all. A `test` or `select` that an attribute of a literal result
  element happens to spell is text bound for the result tree, so it is left
  alone rather than read as XPath and rewritten (#589, #579, #606, #849,
  #654, #647, #788, #556).

- Stop reading an element by the prefix one document chose. A stylesheet
  writing its XSLT as `XSL:` was read by no check that asked for `xsl:`, and
  a literal result element whose `xsl:` is bound elsewhere drew eight of them
  at once (#784).

- Withdraw the check-specific false positives: `not-using-output` where the
  `xsl:output` comes from an imported module (#548);
  `stylesheet-has-no-templates` on an import-only, output-only or overriding
  module (#494); `output-method-xml` on an XML document embedding an html
  fragment (#495); `sort-not-first` on an `xsl:with-param` standing before
  the `xsl:sort` (#487); `blank-nested-if` where the outer `xsl:if` holds
  text (#491); `name-starts-with-numeric` on an empty `@name` (#489);
  `using-disable-output-escaping` on a literal result element (#556);
  `use-node-set-extension` on any `*:node-set(` (#557);
  `redundant-namespace-declarations` on a prefix named only by an
  `exclude-result-prefixes`, and two columns to the right of a spaced
  declaration (#553, #681); `use-double-slash` on a union branch opening with
  `//` (#586); `using-namespace-axis` on a string literal (#497, #595); the
  two `count(*)` checks on whitespace an `xml:space="preserve"` keeps (#817);
  and the `count`/`string-length` comparisons on an arithmetic operand
  (#573).

- Find the constructs a text scan missed: an `fn:`-prefixed call (#577,
  #596), the `eq`/`ne`/`lt` family XSLT 2.0 added (#763), a double-quoted
  string literal (#598), a call whose argument count makes the rewrite wrong
  (#576, #730), a `self::node()` and a whitespaced axis (#564), the `@use`,
  `@value`, `@group-by` and pattern attributes (#502), and every gap XML
  calls whitespace rather than the wider set JavaScript's `\s` matches (#643,
  #615, #639, #642).

- Accept the stylesheets every processor loads, and refuse what XML forbids.
  An entity whose name holds a dot and a file opening with a UTF-8 byte order
  mark are no longer `malformed-stylesheet` — which had left them linted by
  nothing at all — while a bare `&`, an unquoted attribute value and a `]]>`
  in character data are (#877, #574, #691).

- Stop `--fix` corrupting a stylesheet. Two fixes whose spans overlap cannot
  both be applied in one run: the left-most wins, the wider of two starting
  together wins, and the loser is announced and left in the report for a
  later run (#571). A comparison written with `&lt;` or `&gt;`, or shifted by
  an entity earlier in the same value, is located and fixed rather than
  skipped (#518, #525, #803); a CRLF line ending counts as one character
  (#626); a fix value is matched across a line wrap (#629); and five fix
  builders read an attribute's column and text off the source rather than
  inventing them (#718, #594, #611).

- Correct the fix tiers that changed behaviour. `count-compared-to-zero`
  emits the version-appropriate form — `exists()`/`empty()` on 2.0 and later,
  `boolean()`/`not()` on 1.0 — rather than XPath 2.0 functions a 1.0
  processor has never had (#485, #537); `string-length-compared-to-zero` no
  longer rewrites an emptiness test into one that differs when its subject is
  absent (#488); `starts-with-double-slash` withholds inside an
  `xsl:template`, where dropping the `//` shifts the rule's priority (#583);
  and `redundant-import` deletes only where deleting cannot move import
  precedence, on every spelling of an href rather than one (#667, #793).

- Stop the crashes and the silent losses. Walking a wide directory no longer
  throws a `RangeError`: the walk spread its findings into a `push`, whose
  arguments V8 caps at roughly 125 per kilobyte of stack, so this
  repository's own 768,731 files died before a byte of XSL was read (#758).
  The report is no longer truncated when stdout is a pipe, `process.exit`
  having ended the process where it stood and abandoned every write the
  kernel had not taken — 720 defects over twenty stylesheets arrived as
  65,492 of 165,500 bytes, with the exit code still right (#767, #822). And a
  defect built with one argument missing no longer reports at the wrong place
  (#601).

- Order the report deterministically — by file, then line, then column, then
  rule — so two runs over one tree emit the same document; and give the
  `json` reporter a `fix` object per fixable defect, holding that span's own
  line and column, the value it replaces, the replacement it would write, and
  whether it is a suggestion (#638).

- Make the run linear where it was quadratic. The cross-file linter tested
  every declaration against every usage and cost DocBook-XSL 44 seconds; it
  builds one index instead (#755, #783). Every internal `//` scan is served
  from one remembered walk of the document rather than a traversal per check
  (#635, #633, #784, #839, #811), `circular-import` walks the graph once
  rather than once per edge (#769), `unused-function-template-parameter`
  reads a body once rather than once per parameter (#776), and the version
  lookup remembers the ancestor chain it used to re-walk 950,645 times a run
  (#845).

- Answer in 72 ms where `--version`, `--help` and every rejected argument
  used to cost 137: the pipeline is imported inside the command action rather
  than at the top of the entry point, and the 68 check YAMLs are pre-rendered
  to one JSON a run requires (#687, #689).

- Measure speed, which nothing did while that quadratic reached master with
  eighteen jobs green. Every stage answers for its own share of a run's
  processor time at two corpus sizes on every pull request, and a nightly job
  times DocBook-XSL, TEI and DITA-OT at pinned commits against a budget
  judged from both sides — past it the run has slowed, far under it the
  budget has stopped being a bar (#756, #777, #785, #800, #827). Every defect
  the three corpora draw is committed and diffed too, so a check that changes
  what it reports, or what it would rewrite, says so (#638).

- Retire the `mature: true` freeze rather than leave a mark the tree could
  not back. Nine checks carried it, all nine were unfrozen, and the gate that
  was meant to hold them asserted nothing (#568, #588, #637, #865).

- Derive the `CHECKS` list that `--suppress` and the config `rules` keys
  match from the linters themselves, so a name cannot desync from the check
  it suppresses, and share one defect builder and one comparison scan across
  the code-based linters (#503, #500, #501).

- Enforce the conventions this project states. A source file stops at 1000
  lines and a JSDoc block at five lines of description (#748, #821, #825,
  #832, #844), a function leaves through one `return` (#623), no linter or
  validator imports another (#715), and a check selector may not test
  existence by counting, name an element by its prefix, or read one spelling
  of an attribute XSLT allows in two (#621, #784, #849).

- Fold twenty-two pack harnesses into one, so an assertion the packs carry is
  written once and every directory gets it — one of them asserted no fix at
  all while `redundant-import` attached a real deletion, the block written
  into the others never having reached it (#660, #607, #592, #506, #507).
  The xcop suite registers a pending fixture rather than skipping in silence
  when the tool is unreachable, reads each fixture's verdict out of one
  report rather than spending a ruby interpreter per assertion, and no longer
  loses every verdict behind the first file it refuses (#645, #693, #687,
  #505, #504).

- Fix the CI that could not report. The nightly and corpora `report-fail`
  jobs had no `issues: write` and so filed nothing (#826), `deps-sentinel`
  had no `pull-requests: write` and so commented nothing (#856), and `grunt
  mochacli` and `grunt eslint` ran a nested mocha 8 and eslint 9 beneath the
  12 and 10 `package.json` declares — where two of nine advisories lived
  (#841, #855). ESLint runs once rather than across the six-cell matrix, and
  before mocha rather than after it, where a failing test masked it (#509,
  #510, #511).

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
