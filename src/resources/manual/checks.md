# How xslint checks

The full list of checks with descriptions and examples is available at
[the check catalog](../index.html).

xslint runs in two stages. **Validators** first establish that the input is
valid; **linters** then run over the stylesheets that pass, catching
stylistic, semantic, and logical problems. A stylesheet that does not parse is
reported once and skipped, so one broken file never hides the feedback on the
rest.

Validators:

- **XML well-formedness** — a stylesheet that is not well-formed XML, or
  that spells a namespace prefix it never declares, is reported at the line
  and column the parser stopped on and excluded from linting.
- **XPath syntax** — every bare XPath expression (in `select`, `test`,
  `use`, `value`, `group-by`, `group-adjacent`, and the XSLT 3.0 `key`,
  `initial-value`, `xpath`, `context-item`, `with-params`,
  `namespace-context`, `for-each-item`, `for-each-source` and `use-when`) is
  parsed, on an XSLT element or — spelled `xsl:use-when`, the only spelling a
  simplified stylesheet has — on a literal result element; the ones the processor
  cannot parse are reported.

Linters:

- **Per-file** checks evaluate one stylesheet at a time (most checks).
- **Cross-file** checks reason across all the stylesheets you lint together.
  For example, a named template defined in one file but invoked from another
  (via `xsl:import`/`xsl:include`) is not reported as unused, an
  `xsl:import`/`xsl:include` cycle across files is flagged (`circular-import`),
  and the same module imported twice in one stylesheet is flagged
  (`redundant-import`).
  Lint the whole project at once so these checks can see every caller and every
  imported module.
- **Formatting** checks are written in code rather than as a declarative
  selector — their YAML tunes only `severity` and `message`. Most read the
  parse tree of one expression; the rest read the document or the import
  graph. The [check catalog](../index.html) teaches every one of them.

Every check that reads an expression reads it from an XPath or pattern attribute
of an XSLT element (`select`, `test`, `match`, …) or from an attribute value
template — `<div class="{count(item) = 0}"/>` is checked, and fixed, inside the
braces. An attribute of your own output vocabulary that happens to share a name
with an XSLT one, as in `<widget test="count(item) = 0"/>`, holds text destined
for the result tree, so it is never read as XPath and never rewritten. And each
of them is handed the expressions the validator kept, so a malformed one is
reported once rather than nagged about its spacing, its axes and its
`count(...)` calls on top of that.
