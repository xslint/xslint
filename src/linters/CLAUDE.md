# `src/linters/` — module notes

One linter per construct, and why each reads what it reads. The staging that hands them
their input, the flow diagram, and the rules for adding a check are in the root
`CLAUDE.md`; the shared modules they consume are in `src/CLAUDE.md`. A note that outgrew
the chain stands at the top of its own module instead, so a linter the root index names
with no section here carries its derivation in its own file header (#844).

## `src/linters/parameter-linter.js`

`unused-function-template-parameter`, the first check to leave `checks/xpath/` for code (#776). Its
selector asked `not(some $x in ..//(node() | @*) satisfies contains($x, concat('$', @name)))` — one
descendant step per *parameter*, and fontoxpath evaluates one of those over an xmldom tree
quadratically, which is #635's cost re-entered once per parameter and never reaching the walk
`src/tree.js` remembers. So a template cost its parameter count times the square of its body: 3.54,
3.82 and 4.27 per doubling of the body at five parameters, 2.05 to 2.20 per doubling of the
parameters against a 400-element body, 6.6 seconds for one template of 1600 elements. It was the
single most expensive thing in a run, 2.82 s of DocBook-XSL's 11.0 s of per-file checking, and it is
0.08 s here — one walk per holder rather than one per parameter, which is `walked` filtered for the
`@name` of an `xsl:param` whose parent takes one. What the substring could not ask is what a
*reference* is, and the tree closes four blind spots the selector had: `$name` is not a use of `$n`,
though it holds those characters; a `'$quoted'` is a string literal, which XPath evaluates to text;
the output text of a literal result element is characters bound for the result tree; and a name
inside an XML comment is a reference somebody switched off, which is the commonest of the four in
real code — 15 of the 19 new defects over the three corpora, against 4 of the prefix class (`$row`
silenced by `$rownum`, `$minimal` by `$minimalCrossRef`, `$force` by `$forcePageMaster`, `$prefix`
by `$prefixTokens`), and nothing at all withdrawn. It is a *document* linter rather than an
expression one for a reason worth keeping: it reports a **declaration**, an element no expression
names, and a stylesheet holding no expression at all still declares parameters — staged over what
the validator kept, such a file would contribute no record and its dead parameters would go
unreported. So it reaches `expressionsOf` itself, and an expression the grammar refuses is the one
place the substring survives: what such text references cannot be read, and staying quiet about a
name whose characters stand in it beats inventing an unused parameter on a file the same run already
reports for its syntax.

## `src/linters/element-linter.js`

`not-creating-element-correctly`, one of the five checks #788 took off the declarative kind (#558).
What makes an `xsl:element`'s name dynamic is an attribute value template and nothing else, which is
`expressionsOf`'s answer rather than a substring's: the selector read a `$`, a bracket pair and a
brace pair out of the value, so a `name="$wanted"` counted as dynamic where XSLT evaluates nothing
there — the dollar is part of the name the element is given — while the AVT it did catch it caught
by two characters rather than by holding an expression, so a constant `name="{'div'}"` went
unreported. It reads the `@name` of every `xsl:element` off the one walk `src/tree.js` remembers,
never a descendant step of its own (#635). Two static names keep the instruction. One whose prefix
binds to the XSLT namespace has no literal form at all: `<xsl:element name="xsl:template"/>` writes
an element into the result tree where `<xsl:template>` is an instruction the processor runs, so the
advice would turn a stylesheet that emits into one that declares — and it is the namespace the
prefix resolves to that answers, never the prefix, a document binding `xsl:` where it pleases. The
other carries a `namespace` attribute, which names a namespace outright where a literal result
element takes its own from the prefixes in scope.

## `src/linters/output-linter.js`

Its derivation stands at the top of `src/linters/output-linter.js` itself, the dearest note this
guide held: the root indexing one more script left this chain the dearest of the six, and a note
moves one directory further down rather than a bar being widened to fit it (#821, #884).

## `src/linters/bare-name-linter.js`

`confusing-variable-and-node`, the head step of a path whose node test is a bare name a variable in
scope has already taken — `<xsl:apply-templates select="items"/>` under an `$items` — which the tree
answers and the front of an attribute's text cannot. `starts-with(@select, concat($var/@name, '/'))`
read the value's first characters, so the same name behind a gap, under a predicate, or in any
branch of a union but the first went unreported, and what it did read it read as characters: an
`@title` and a `child::title` hold them and test nothing of the kind. Only a head is confusable, a
step deeper in a path being a child of whatever stands in front of it and reading as nothing else.
Scope is the nearest ancestor template and the variables declared in front of the element, which is
what the selector's `$var << .` said (#788) — and, since #560, the stylesheet's own
top-level declarations, a global being in scope in every template however the two are ordered where
a climb to `ancestor::xsl:template[1]` sees only the local ones. The instruction is four and not
one for the same reason: `xsl:value-of`, `xsl:copy-of` and `xsl:for-each` read a `select="items"`
as the child element exactly as `xsl:apply-templates` does. Three reports over the corpora, of
which TEI's `profiles/jtei/odt/odt.common.xsl:749` is the new one — an
`<xsl:for-each select="graphic">` forty lines under its own template's
`<xsl:variable name="graphic" select="graphic"/>`. The globals are remembered
against the document, since they depend on it alone and the scan asking for
them runs once per expression: spelled the other way the stage read 7.08% of
its run against a bar of 7, and `test/scaling.test.js` is what said so rather
than a reviewer.

## `src/linters/*-linter.js`

Code-based `checks/format/*.yaml`, one construct each (axis, namespace, count, name, ...); see the
flow diagram in the root `CLAUDE.md`. Ten of the thirteen read the tree rather than the expression's
text, which is what Phase 4 of #644 is moving all of them onto: `count-compared-to-zero` and
`string-length-compared-to-zero` through `src/comparisons.js` (#577); `predicate-position-literal`,
which walks the `predicate` nodes the grammar built rather than matching brackets and reducing what
stands between them to one character per token (#575); and `redundant-boolean-call` and
`redundant-double-negation` through `src/booleans.js`, which answers where a truth is all that is
taken (#561, #596); and `name-compared-to-string` and `translate-for-case`, which read what a
literal *holds* rather than how it is quoted (#598, #562); and `starts-with-double-slash` with
`use-double-slash`, the pair a selector could not tell apart (#490, #586); and
`use-node-set-extension`, where the extension is the function two namespaces declare and not a local
name behind any prefix at all (#557). The tenth arrived at #788 and has a row of its own above,
`confusing-variable-and-node`, which reads the head step of a path where a substring read the front
of an attribute. That last one had a false positive and a false negative of its own and one shape
underneath both: `[\w.-]+:node-set` took the local name as the whole of the question, so
`my:node-set($v)` drew advice to drop a call to somebody's own function while the inline
`Q{http://exslt.org/common}node-set($v)` drew nothing, and `msxsl:node-set` was right by accident
rather than because the URI says so. It also scanned `@select` alone, so the same wrapper in a
`@test` was invisible, and the braces of an attribute value template with it — where a processor
evaluates the expression whatever element carries the attribute, the whole `select` of a literal
result element being the only one that is output text. And it read a call's arity by counting
commas, so `exsl:node-set()` was unwrapped into nothing: `select="/alpha"`, a **safe**-tier fix
writing the expression the next run reports, which is #576's family exactly. What it writes keeps
the brackets the call supplied where the argument binds looser than a step, which is `STEPPED` in
`src/syntax.js` and the last unwrapper to get a precedence answer of its own (#774). Those two are
one blind spot twice over: a regular expression naming `'([^']*)'` cannot see `"x"`, and an
attribute value already standing in double quotes is written the other way round, so half the
spellings of each construct went unreported. The tree closes four more gaps their tickets do not
name — the value comparison, blind on `name() eq 'x'` as #763 was blind on `count(x) eq 0`; the
prefixed and inline spellings of both standard calls, where `[^\w:.-]` refused `fn:name()` outright
and read `Q{urn:mine}translate(...)` as the bare call; a binding clause inside one argument, whose
depth-zero commas made a three-argument `translate` read as four; and a name no ASCII class spells,
`qualified` in `src/tokens.js` answering that where a `NAME` regular expression of the linter's own
refused `name() = 'é'` a `self::é` step says perfectly well. The two of those are one pair rather
than two migrations: a `boolean(x)` is redundant exactly where `not(not(x))` reduces to a bare `x`,
so migrating one alone would have `--fix` write the very defect the other reports next. What a text
scan cannot answer for either is what a place *is* — `not(boolean(@x))` is a question about the node
above, and a prefixed `fn:not(fn:not(@x))` one about a namespace — and the overlap of a run of them:
a scan matching the character in front of a call consumed it, so `not(not(not(not(@deep))))` drew
two defects rather than three. Three things follow from `predicate-position-literal`'s own
migration, and are about a predicate rather than about a truth. A predicate is judged by what its
one child *is*, so `[position() = 1 and @on]` holds a comparison and is not one — an `and` is what
the predicate holds, and rewriting the comparison inside it would turn a positional test into the
boolean `[1 and @on]`. The operand that survives keeps the spelling its author gave it, so a
`fn:last()` stays prefixed, where a signature reading `TOKENS.NAME` alone never saw a prefixed call
and left the predicate unreported. And the defect stands where its comparison does rather than just
inside the `[`, so a padded `[ position() = 1 ]` is reported at the `p` and the fix replaces the
comparison alone, leaving the author's gaps where they were. The double slash trio is one construct
read three ways, and two of the questions it asks are ones a selector had no way to put. What a `//`
*is*: `contains(@match, '//')` counted the one in `match="alpha[@url = 'http://example.com']"`,
where the lexer gives a string literal, a comment and an inline `Q{...}` one token each and not one
of them holds a separator (#490). And where one *stands*: the checks split the work by whether the
slashes led the string, which holds only while the pattern is one branch, since a branch of a union
is matched unanchored exactly as the whole pattern is. So the `//` of `match="alpha | //beta"` is
the first check's redundancy and drew the second's advice instead, with no fix behind it — while the
`//` of `mu[nu | //xi]` opens no branch, a predicate holding an expression rather than a pattern,
and stays the broad step it is. A `branch` node with nothing of its own to the left of the `//` is
the whole of the test, so a bracketed branch counts and 3.0 admits one anywhere in a path. Two more
things came with the kind. The fix cuts the two characters where they stand rather than rewriting
the value around them, so it no longer overlaps `redundant-whitespace` on a `match=" //spaced"` and
both land in one run, and every branch of `match="alpha | //beta | //gamma"` loses its own where one
whole-value substitution could only ever drop the first (#571). And the pair reads every attribute
holding a pattern — `PATTERNS`' five names, standing in seven places over five elements — rather
than `xsl:template/@match` alone, so an `xsl:key` matching `gamma//delta` is reported at last. The
third check is the same shape one attribute over: `select-starts-with-double-slash` was declarative
and selected `//*`, so it read the `select` of a literal result element as XPath — output data no
processor evaluates — and `--fix-suggestions` wrote `.//` into the result tree, a check about
expressions changing what a stylesheet emits (#788). It is handed the records the validator kept,
which hold no such attribute, and the `//` it reports is the first token of the parse rather than
the first characters of a value, so a comment or a gap standing in front of one no longer hides it.
