# `src/linters/` — module notes

One linter per construct, and why each reads what it reads. The staging that hands them
their input, the flow diagram, and the rules for adding a check are in the root
`CLAUDE.md`; the shared modules they consume are in `src/CLAUDE.md`.

## `src/linters/xpath-linter.js`

Loads `checks/xpath/*.yaml`; attaches any `src/fixers.js` fix, unless the node — or the element
carrying it — holds an expression the grammar refuses (#651). The element is listed because a rule
selects it while its fixer reaches sideways for an attribute no gate can read; its own attributes
are listed with it because a rule may select the attribute instead, which is what
`starts-with-double-slash` did until #586 took it to code, so nothing declarative selects one today
and that half of the set stands for the shape rather than for a rule the tree still holds. It is the
dearest stage there is, 39% to 50% of a run over the three corpora — 42% to 56% before #811's anchor
phase and 46% to 58% before its union phase, those two being the moves that made the stage itself
cheaper rather than the denominator smaller, 39% to 44% after #784, and 49% to 55% before that, all
of them read the same way, as processor time over the whole staged run with both validators in the
divisor: read against the linters alone this stage is 61% to 72% of them, a number that belongs
beside none of the others, and what makes it dear is the **breadth of a step** rather than the
number of checks: fontoxpath evaluates a descendant step over an xmldom tree quadratically (#635),
so a `//*` or a `//xsl:*` pays for every element in the document and then filters, where a
`//(xsl:variable | xsl:template)` pays for the two names. Eight selectors were written the broad way
and are narrowed at #784 — `xpath-linter` falls from 7.52 to 6.11 seconds over DocBook-XSL, 6.20 to
4.90 over TEI and 2.33 to 1.82 over DITA-OT, taking the whole run down 13% to 15%. Three of the
eight are a *correctness* fix in the same edit, which is why the narrowing is not merely a
refactoring: `name()` answers the lexical QName, so `//*[name() = 'xsl:variable']` asks how one
document happens to spell the XSLT namespace rather than anything about XSLT. TEI's
`rdf/make-acdc.xsl` writes its XSLT as `XSL:` and binds lowercase `xsl:` to a `TransformAlias`, and
`short-names` reports a template there that master reads past — the false negative, one defect over
the three corpora with none withdrawn. The false positive is the same fault mirrored, an aliased
`xsl:` on a literal result element drawing a check about XSLT, and it is pinned by a pack rather
than by a corpus: no committed stylesheet spells it, which is what let the shape survive. The other
five ask no question about a prefix and are narrowed alone — three of them by anchoring on the
attribute the check is really about, `//@select[...]/..` in place of `//*[...@select...]`, and one
by folding two descendant walks into one parent test. What the ticket proposed instead was a
precondition per check — skip a (document, check) pair whose name the document does not hold — and
that measures **4.5%**, not the 54.7% it is aimed at, because the pairs a precondition can skip are
the cheapest pairs there are: proving `//xsl:sort` empty on a document holding no sort is nearly
free, and the cost was never in the checks that find nothing. What was left of the ticket after that
change was one selector evaluation per check per document — 38 of them, 35 holding a descendant step
— and the answer is the walk `src/tree.js` already remembers, not a precondition in front of each.
`splitOf` in `src/selectors.js` parts a selector into the names a bucketed walk can serve and the
tail the engine must still answer, so 24 of the 38 take their axis off one native pass and pay
fontoxpath for a predicate over the candidates alone — 27 since #811 served a union of them and 30
since it served what stands below an anchor. `xpath-linter` falls from 5.64 to 3.64 seconds over
DocBook-XSL, 4.63 to 2.82 over TEI and 1.97 to 1.32 over DITA-OT — 35%, 39% and 33%, the lowest of
three interleaved rounds a side — taking the staged run down 20%, 21% and 16%, and the report is
byte-identical on all three, at 3843, 5716 and 1266 defects. What the uniformity costs is one
wrapper per candidate: a tail is asked as `self::node()` followed by the selector's own predicates,
which is 0.05 s over DocBook-XSL against asking each predicate bare, the lowest of seven interleaved
rounds a side, and it is kept because one shape for every tail is worth more than a special case per
selector. The eight it cannot serve are listed in `UNINDEXED` in `test/conformance.test.js`, each
beside the shape that keeps it out, and that gate turns red from both sides: a selector that becomes
servable and stays listed fails as loudly as one that stops being served. What those fifteen still
spent when that was measured is 2.78 of the stage's 3.64 seconds over DocBook-XSL, and a reason on
that list is not a statement about cost: nine of them were root-anchored, which kept them out
because a root step is no descendant sweep, yet six of those nine descended *below* their anchor —
and #811's anchor phase serves three of the six, an anchor being one question for the document where
the sweep behind it was a traversal apiece. The eight left are 1.27 of the stage's 2.83 seconds over
DocBook-XSL, five of them the root itself with a predicate that descends, where the axis is one node
and the whole cost is inside the brackets. The dearest is still `modern-construct-in-xslt-1`, at
0.63 s, whose union ends in an `xsl:*[@as]`: nine narrow arms the walk already holds, a tenth naming
a whole namespace, and a predicate on that tenth which `hasAttribute` answers in 10 ms where asking
the engine once per candidate costs 150. So what a richer index takes next is still drawn by cost
rather than by the shape that excluded it. Swapping the DOM underneath was measured instead and
refused: slimdom, fontoxpath's own development dependency, answers `//*` over DocBook-XSL in 0.271 s
where xmldom takes 0.869 and the native walk of those 69,842 elements takes 0.011 to 0.020, so it
buys a quarter of a traversal and leaves the rest — and it parses 283 of the 315 stylesheets where
xmldom parses 297, which is a different report rather than a faster one.

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

## `src/linters/root-template-linter.js`

`template-writes-nothing` and `output-method-xml`, of which only the second still asks which
template is the *root* one — `starts-with(@match, '/')` until #788, where every absolute pattern
begins that way. So
a `match="/alpha"`, a template for an `alpha` element standing at a document's root, was read as the
root template and told that it "contains only variable declarations", which is advice about a
template the stylesheet does not have; this repository's own motive rule names that error. The
pattern grammar answers it now: a pattern is a union of branches and the root is the branch holding
no step at all, so `match="/"` is one and `match="alpha | /"` is one, where `match="/alpha"` and
`match="document-node()"` are not. The first check asked it too until #559 and had no
business to: what a template writes its own body decides, and a `match="item"` holding nothing but
variables is as dead as the root one, in a way no processor reports since an empty result is legal.
It reads every `xsl:template` off the shared walk now, named ones included, and is named for what it
is about rather than for what the stylesheet produces. Both its packs had asserted the narrowing,
each carrying a variable-only `match="/objects/o/o[…]"` the fixture expected to stay quiet, which is
what #494's packs turned out to be doing. A body of nothing but `xsl:param` is left alone
deliberately: DocBook-XSL's `xsl/fo/math.xsl` has both four lines apart, variable-only at 65 and
parameter-only at 60, and a parameter is a signature a template may keep while producing nothing on
purpose. That one at 65 is the whole of what the widening reports over the three corpora. A
template writes nothing when every element it holds is an
`xsl:variable` and every text node of it is blank — a CDATA section being one kind of text and not a
construct of its own, which is what a `text()` step says too. The `xsl:output` the second check
reports is taken from the stylesheet's own children, XSLT reading a declaration nowhere else, and
its fix rewrites the value alone through `substitution`. What makes the result HTML is the
**outermost** element the template builds and not an `html` anywhere under it, which is #495: an XML
document may embed an HTML fragment and stay XML — an Atom entry's `content`, an XHTML island — so a
check reading any descendant told a valid feed to serialize itself as HTML and `--fix-suggestions`
rewrote the `method` to match, which emits unclosed tags and no XML declaration. Outermost means
every element up to the template is an XSLT instruction that passes its content through, which is
every one of them but the eleven in `DIVERTED` — three binding a value (`xsl:variable`, `xsl:param`,
`xsl:with-param`), `xsl:element` building the wrapper its content becomes children of, three
reducing it to a string (`xsl:attribute`, `xsl:comment`, `xsl:processing-instruction`),
`xsl:message` writing to the message stream, `xsl:result-document` opening a secondary document with
a serialization of its own, and `xsl:map-entry` and `xsl:array-member` building a map's value or an
array's member, which is a value and not a node the element above it holds. Their containers are
outside the list and the asymmetry is deliberate: an `xsl:map` holds a sequence of maps and an
`xsl:array` a sequence of arrays, so an `html` directly inside one is invalid XSLT rather than
output standing anywhere — that last being the one with teeth, since a stylesheet already declaring
`method="html"` there drew the warning against its *primary* output and the fix would have rewritten
that. The list is named for the rule rather than enumerated to fit it, which is what the first
spelling did: `BOUND`, two names and a docblock about binding, left four shapes reporting that its
own sentence excluded. What keeps it honest is a gate rather than the reviewer who found that, since
the second round of the same defect was the packs and not the list — four names sat behind a
`<report>` literal result element, which makes an `html` non-outermost whatever the list holds, so
dropping all four left every test green, and `param` was asserted by nothing at all, inherited from
the two-name spelling. A pack's zero has to come from the name under test:
`test/root-template-linter.test.js` walks each `html` in each pack up to its template and refuses a
name that no pack leaves standing **alone** above one, so a name masked by a wrapper or added
without a shape of its own turns red — which is #645's shape, a fixture whose zero another mechanism
produces reading exactly like one that passed. xsltproc settles the eight of them XSLT 1.0 has by
showing what each builds — an `html` under `xsl:element` comes out `<wrapper><html/></wrapper>` and
one under `xsl:message` never comes out at all — and `xsl:copy` is deliberately absent, copying the
*document node* being transparent, so under a root template an `html` inside one really is the
document element and xsltproc answers `<html><body/></html>`. The namespace decides the other half:
an `html` a document puts in the XHTML namespace is XHTML, which serializes as `xml` in 1.0 and
`xhtml` from 2.0 and never as the `html` this check recommends, so it is left alone rather than
given advice its version cannot take — the false negative #495 names beside the false positive,
which wants a check of its own rather than the wrong half of this one.

## `src/linters/output-linter.js`

`not-using-output` was a per-file selector — `[xsl:template and not(xsl:output)]` — and an
`xsl:output` is not a per-file fact. It merges into the sheet that imports it and governs the whole
import tree, so a main module that pushes its serialization into a shared `_output.xsl` was reported
for missing what it had, and the module holding it was reported by
`stylesheet-has-no-templates` for holding nothing else. One decomposition, punished at both ends,
and the one `too-many-templates` recommends (#548, #494).

The question needs the graph, so the check moved to the code stage and the YAML kept only its
severity and message. `graphOf` yields an edge only where the target is in the corpus, which is half
of what #468's guardrail asks; the other half is that an href leaving the linted set means *external,
assume fine*. Both are the same rule read from either side — never invent a defect out of what we
were not handed — so linting one file of a project cannot report what linting all of them does not.
Reachability is transitive, an `xsl:output` three imports down governing as surely as one directly
imported, and it is not directional either: a tree serializes together, so the module holding the
only templates is answered by the sheet importing it as much as by the ones it imports. Saxon over a
`main.xsl` declaring `method="text"` and a `_lib.xsl` declaring nothing emits text, where `_lib.xsl`
alone emits XML. So the question is the tree's rather than the file's, and a module is quiet when any
tree holding it declares an output or reaches outside. Downward alone answers the smaller half:
DocBook-XSL's 178 reports fall to 143 that way and to 19 with both directions, TEI's 159 to 112 and
then to 14, DITA-OT's 118 to 95. What survives is what should — `anttools/xspec/coverage-report.xsl`
is a `match="/"` with no `xsl:output` that nobody imports.

Ten *decisions* carry it, `rooted` being two and `outward` two, and mutating each says what pins it:
seven redden a single pack, `supplying` four, and the file's own place in its own reach five. Read
coarsely — `rooted` one decision and `outward` one — it is four that redden a single pack. Neither
reading is the other's, so a count here is stated with the decomposition it was taken under, a
sentence claiming five having been true under neither.

One decision no pack defeats. The namespace half of `rooted` fires only on a root *named* stylesheet
or transform outside the XSLT namespace while holding XSLT children, which is no stylesheet at all,
and it stays: a local-name test standing without its namespace is the shape this repository refuses
everywhere else. Two the first spelling carried are gone, for two different reasons.
`!holds(xsl, 'output')` beside the report was redundant against every input there is, a file holding
one being in `supplying` and so settled through its own reach before the conjunct is read. `rooted`
inside `supplying` fired only on a root that is neither stylesheet nor transform yet holds a
top-level `xsl:output` — an `xsl:package`, where it was wrong, a package's output governing the
modules it imports as any other does, or a shape XSLT refuses; 842 corpus stylesheets hold neither.
So one went for deciding nothing, one for deciding wrongly, and the third stays for deciding rightly
where nothing valid reaches it. What `rooted` decides whole is the file judged, and the package is
that live case: reached by `xsl:use-package`, an edge this linter does not follow, so judging one
invents a defect out of a tree nobody handed us — #468 once more.

## `src/linters/corpus-linter.js`

Loads `checks/corpus/*.yaml`; cross-file rules. A cross-file check asks one question of every
declaration against every usage, so both sides grow with the project and the work is their product;
three things made that product far dearer than it is. A usage selector is now evaluated once for
each corpus and xpath (`across`) rather than once for each check naming it — three of the four
checks give `//@*`, and choosing every attribute of DocBook-XSL's 291 stylesheets costs 1.7 seconds,
so the run spent five answering one question three times over. A reference string was built once for
each declaration rather than once per pair, and the usages holding it scanned once for each
*distinct* reference, DocBook-XSL declaring 3436 variables under 1207 names; and the cheap test led,
`within` climbing to the document root for every pair it rejects where one `includes` rejects almost
every pair. Together those took the four checks from 35.0 to 10.2 seconds over that corpus and the
whole run from 40.2 to 29.8 (#755). What they left standing was the product itself, the scan still
being every distinct name against every usage — 1207 against 72,077 attributes, 87 million substring
tests, and 98% of what the stage spent, `unused-variable` alone accounting for 13.58 of its 13.81
seconds of scanning. The index is what retires it (#783). `referencing` reads each usage value once
for a template and yields the names it *references*; `indexed` maps each name to the usages holding
it, once for a usage set and template; and a declaration is a `Map.get` rather than a scan.
`corpus-linter` falls from 8.52 to 2.20 seconds over DocBook-XSL, 6.26 to 1.21 over TEI and 1.37 to
0.56 over DITA-OT, taking the staged run from 17.54 to 11.13, 14.33 to 9.34 and 4.48 to 3.62, and
the stage from half the run to a fifth of it. Speed is the smaller half. A substring is not a
reference: `includes('$row')` is answered by `$rownum`, which is #776's defect on the other side of
the same product, so the fix and the speed-up are one edit and the report is not byte-identical —
four declarations that were silenced by a longer name holding their characters are reported, `$page`
behind `$pageid` and `$target` behind `$targets` in DocBook-XSL, `$v` behind `$values` and
`$Heading` behind `$Heading1` in TEI, with none removed. A name is the run of characters `NAMED` in
`src/tokens.js` spells one with, borrowed rather than a second opinion about what a name character
is. What that costs is a shape, which `anchoring` reads once for a template rather than once per
usage value and refuses where it is wrong: the index finds the template's fixed text and takes the
name from the side that text stands on, so **exactly one** end may carry it. `${name}` and `{name}(`
are the two spellings, and both a bare `{name}` and an `a{name}b` are errors rather than checks that
half work. Neither half is theoretical. Text at both ends leaves the far side unmatched, so a
declaration something uses is reported dead; text at neither leaves the mark empty, and `indexOf`
finds that at every offset and answers the *length* rather than -1 once asked past the end, so the
scan never advances and the whole run hangs before it reports anything. `test/conformance.test.js`
holds every check to the same shape, which is the line that would have caught it — the first
spelling of that gate asked only that the template start or end with `{name}`, which a bare `{name}`
satisfies twice over, so the one shape that hangs was the one shape the gate admitted. What #783
left standing was the traversal itself, this being the one stage that reached the engine directly:
three of its four checks give `//@*` and the fourth `//xsl:call-template/@name`, and neither is an
axis a bucket of elements can hold. It goes through `chosen` and `valued` in `src/selectors.js`
since #811, which serves both of those and its three element declarations besides, so the stage
falls from 2.26 s to 0.11 s over DocBook-XSL, 1.23 to 0.09 over TEI and 0.60 to 0.06 over DITA-OT —
a tenth to a twentieth of what it cost, taking the staged run down 25%, 17% and 11% with the report
byte-identical on all three. Half a run was this stage over DocBook-XSL when #755 was filed and it
is 1.5% to 2.3% of one now, which is why its entry in `SHARES` is gone rather than re-derived.

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
