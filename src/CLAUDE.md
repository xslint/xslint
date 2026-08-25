# `src/` — module notes

What each module here is for and why it is the way it is: the derivation behind it, the
ticket it answers, and the measurement any number in it stands on. The rules a change to
any of them answers to are in the root `CLAUDE.md`, whose `Key files` index names every
file below in one line. Nothing here restates a rule; this is the evidence under one.

## `src/xslint.js`

Orchestrates discovery, config, staging, output; exports the pure `lint` (package `main`), `fixed`,
and `STAGES` — every linter the pipeline runs, named by its module and paired with what it is
handed, derived from `LINTERS`/`EXPRESSION_LINTERS` rather than written out beside them so the speed
gate cannot be measuring a list the run has moved on from.

## `src/config.js`

Resolves `.xslint.yml` (severities/`off`, excludes, `max-warnings`).

## `src/directives.js`

Parses inline `xslint-disable-*` comment directives.

## `src/reporters.js`

`reporterOf(format)` — `text`, `json`, `sarif`, or `github` output.

## `src/checks.js`

Shared for code-based linters: `metaOf`, `suppressed`,
`defect(check, meta, source, found, offset, fix)` — takes the expression whole, as `expressionsOf`
yields it, and adds its `start` to the offset itself (#648); walks the raw text so a wrapped or
entity-shifted value reports where it truly stands (#611). It asks nothing about whether the
expression parses: that gate stood here from #636 until #750 staged every code-based linter over the
expressions the validator kept, which left it a condition no call could fail — a rule every caller
has to remember is worse than a stage that cannot break it. That walk is
`rawly(source, found, offset)`, exported beside it, because a linter needs the raw offset as much as
a defect does: an attribute value arrives with its line endings normalised to spaces, so a check
reasoning about whitespace cannot see a wrap in the value it holds and has to ask the source (#628).

## `src/source.js`

Raw-text walking shared by `checks` and `fixer`: `offsetAt`, `placeAt`, `character`, `skip`.

## `src/selectors.js`

`splitOf(xpath)` — a declarative selector parted into the **names** a shared walk can serve as its
axis and the **tail** the engine must still answer, or no names at all where it can serve nothing
(#784). One shape is split, `//name` or `//(name | name)` with predicates behind it, because that is
the shape a walk bucketed by name answers exactly: a wildcard names no one bucket, an attribute axis
yields no element, and a selector anchored at the root is not a descendant sweep at all. Two
refusals are worth knowing. A **positional** predicate cannot be split, `//x[1]` and `//x[last()]`
asking about the sequence the descendant step produced where a candidate tested on its own is a
sequence of one. Which predicates those are is `filters` in `src/syntax.js`, read off the **parse**
and never off the text, because a number wears more spellings than a digit: `[2 - 1]`, `[1.0]`,
`[- 1]`, `[number("2")]` and `[count(@name)]` pick a position exactly as `[1]` does, and a scan for
a digit catches the last of them alone. A predicate is served only where the parse proves it cannot
be a number, which a kind alone cannot say of two of them: a `call` is its name, `not(@a)` and
`count(@a)` coming back alike, and a **path** is its last step, XPath 2.0 letting one end in a call
that answers an atomic value — so `[a/count(.)]` picks the first candidate where `[a/b]` filters,
and reading the kind alone served eight such spellings. Each top-level predicate is asked separately
too, so `//x[1][@a]` and `//x[@a][1]` are refused as much as `//x[1]` — while a `[1]` nested inside
a path of its own is left alone, the predicate of an `ancestor::xsl:template[1]` being about that
path and not this one. And a prefix the run does not bind is refused rather than guessed,
`namespaced` reading `PREFIXES` from `src/xpath.js` so a bucket means by `xsl:` exactly what the
predicate beside it will mean. The bracket scan walks characters rather than matching a regular
expression, because a predicate may hold a bracket inside a string literal: `contains(@match, '[')`
is one predicate holding one, and counting brackets would part the selector inside the literal. Two
more shapes are served since #811, both of them an **attribute** axis: `//@*`, which `attributed` in
`src/tree.js` answers whole, and one named attribute of named elements, taken off each element a
bucket yielded. A wildcard behind an element name is refused with the rest, no selector spelling one
and the order an element's attributes come in being a question the walk answers for a document
rather than for one element; an unprefixed attribute is not, standing in no namespace by XPath's own
rule where an unprefixed *element* name is a refusal. Beside `splitOf` stand the two doors onto the
served answer, `chosen(xsl, xpath)` and `valued(xsl, xpath)` — the second for a usage read as
strings, an attribute's string value being the value it holds. They live here rather than in a
linter because both the per-file and the cross-file kind ask them and no linter may import another.
The engine is asked inside the branch that needs it rather than as the binding's initial value,
though a value that branches is initialised to its fallback everywhere else in this project: the
fallback here is the very traversal being avoided, so spelling it that way asked fontoxpath for
every served selector as well and then dropped the answer — `xpath-linter` read 50.78% of its run
against master's 31.64% before that was seen, the whole saving spent twice over. A selector is a
**union of branches** since #811's second phase, each branch an axis and a tail of its own:
`branched` parts one at a `|` standing at depth zero — never inside brackets, where it parts the
names of one axis, nor inside a literal, where `contains(@match, '|')` holds one as a character —
and `merged` puts the survivors of every branch back into document order by the rank `named`
remembers, deduplicated, both of those being what XPath's own `|` answers rather than a convenience.
Appending branch to branch would report every `xsl:otherwise` after every `xsl:when`, which is the
defect two buckets of *one* axis had before #784 merged them this way. A union of whole paths is
served whole or not at all, a branch left to the engine needing the two answers merged across a
sequence one side never enumerated; and a union of **attribute** axes is refused for a reason of
another kind — the
merge orders by a rank the walk keeps for elements, an attribute having none, so
`(//@version | //@xsl:version)`, the one selector spelling it, stays with the engine while one
branch carrying an attribute is served as it always was. A branch also carries an **anchor** since
the third phase, which is whatever the selector spells in front of its `//`: `anchored` parts the
two at the first `//` standing outside brackets and quotes, the engine answers the anchor once for
the document, and `descended` keeps the candidates that have one of its answers above them —
climbing to a parent rather than descending from the anchor, so an anchor that chose nothing keeps
nothing, where the other direction would report the whole sweep wherever a guard failed. Nothing is
asked of the anchor's own shape: a path holding no `//` outside brackets reaches a bounded depth
from wherever it starts, which is what makes it cheap, so it goes to the engine as the selector
spelled it rather than being matched against a list of the shapes a root anchor may take. An
attribute axis is refused where an anchor stands in front of it, and that one is about the walk
rather than the shape — the climb reads a node's parent, and an attribute has none.

A union spelled **inside** one sweep is the fourth phase, and the one place a split is not
all-or-nothing. `P//(a | b | c)[Q]` is `P//a[Q] | P//b[Q] | P//c[Q]`, a predicate reaching no
further than one candidate either way, so `spread` writes the arms out and `apart` judges each on
its own. What makes that safe is the arms themselves: `spread` parts a sweep only where every arm
is one element step, so an arm the walk refuses comes back from the engine as elements `named`
has already ranked and `merged` orders both kinds together. Refusing outright is still the answer
where *no* arm can be served, there being nothing to gain from asking the engine one selector in
pieces. The cost of the old rule was one arm answering for the rest:
`modern-construct-in-xslt-1` unions nine named instructions with an `xsl:*[@as]` no bucket names,
so all ten went to the engine and the check read 646 ms over DocBook-XSL, where the nine cost 9,
the wildcard arm 128 and the anchor 11. Over that corpus `xpath-linter` falls 3.62 s to 2.73 and
the staged run 7.02 s to 6.18, the report byte-identical at 3843 defects; TEI and DITA-OT are
neutral, that check already costing about 10 ms on each. The per-pull-request gate does not see it
either — its corpus is not 1.0-anchored and the check barely fires there — so no bar in
`test/scaling.test.js` moves, which is what the nightly corpora tier exists to catch instead.

## `src/attributes.js`

`expressionsOf(xsl)` — every expression a stylesheet carries: a bare/AVT attribute, a 3.0 text value
template, or a shadow attribute, each saying whether it is a `pattern`; `PATTERNS` names the five
attributes that hold one; and `whole(found, name)` for a linter that narrows to one attribute out of
the records it is handed. That helper replaced `selectorOf`, an XPath of this module's own over
every XSLT element's attribute of a name, and `wholeOf`, which built a record from the node it
selected — both of them the shape a linter needed while it scanned the corpus itself (#750). It asks
two things in one call because a linter taking the name alone would read the `test="{boolean(x)}"`
of a literal result element, which the old selector's namespace test excluded: an attribute's whole
value is a record starting at `0`, and a template's expression never does, a brace standing at least
one character in. The name it is asked for is the unprefixed one and an attribute in the XSLT
namespace answers to it, `use-when` naming the `xsl:use-when` a literal result element carries as
much as the bare attribute of an XSLT element — the two being one attribute XSLT spells twice, and
the second spelling the only one a simplified stylesheet has (#654). `wholly` is the same fork one
level down, deciding which attributes hold a bare XPath at all: unprefixed on an XSLT element, or
any name `ATTRIBUTES` holds under the XSLT namespace anywhere. That second half is `xsl:use-when` in
every stylesheet a processor loads, and the rest of its reach is an attribute no version permits —
so what a widened list costs is a second report on a file already refused, not a defect against
working code, which is why the fork is on the namespace rather than on a list of permitted names
kept in step with XSLT by hand.

## `src/xsl-version.js`

`versionOf(node)` — the version in force at a node, from the nearest ancestor's `@version` (XSLT
element) or `@xsl:version` (literal result element), canonicalised as a decimal, walking up from the
element `src/tree.js`'s `holding` answers; `since(version, floor)` for a lower-bound gate; shared
`MODERN`/`KNOWN`/`DECIMAL`.

## `src/tree.js`

`walked(xsl)` — every attribute, text node and CDATA section of a document in document order, walked
once and remembered against it, because fontoxpath evaluates a descendant step over an xmldom tree
quadratically (#635). Beside it `holding(node)` answers which element a node hangs off — an
attribute the element carrying it, a text node its parent, a document its root — which is where
anything a stylesheet's *structure* says about a node is read: the version in force there, and the
namespace a prefix inside an expression resolves to. It lived in `src/xsl-version.js` while the
version was the only such question; the second one is #577's, and xmldom's own `lookupNamespaceURI`
answers null on an attribute rather than walking to its element, so both callers need the same
answer rather than each reaching for an element its own way. Beside them `named(xsl)` answers that
walk asked a different way: every element of the document in one pass, bucketed by `namespaceURI`
and `localName`, with the document-order rank of each — which is what lets a declarative check take
its **axis** off the walk instead of having fontoxpath descend the tree once per check (#784). One
walk over 66,008 elements costs 11 to 20 ms where one fontoxpath `//*` over the same tree costs 817
to 1003, so the 43 selectors needing a descendant step were paying for 43 traversals of a corpus the
run had already walked. The rank is what a union needs: `//(xsl:variable | xsl:template)` is a path,
XPath answers a path in document order, and nothing downstream sorts a defect list — so two buckets
are merged by rank rather than concatenated, or every `xsl:template` defect would be reported after
every `xsl:variable` one. `attributed(xsl)` is the third question over the same pass, every
attribute of a document in document order: the sequence `//@*` selects, which three of the four
cross-file checks are written in and which cost fontoxpath 1.613 s over DocBook-XSL — 18% of a whole
run for one selector — where these 72,077 attributes come off the walk in 8 ms (#811). Correcting
one thing made that possible: the walk sorted an element's attributes by **node** name and this row
claimed that was the order the engine yields them in, which holds only until an attribute carries a
prefix. fontoxpath sorts by **local** name, ties left as written, so a `table` written
`summary border xml:id` comes back `border xml:id summary` where the whole name puts `summary` first
— 37 files of the three corpora hold such an element, and with the comparator corrected the walk and
the engine agree on all 152,296 attributes of them.

## `src/comparisons.js`

`comparedToZero(found, name, decide)` — the shared scan for a call compared with `0`/`1` (count,
string-length), and the first check to read the tree rather than the text, which is Phase 4 of #644
opening. It walks the nodes `VALUED` names, which `src/syntax.js` hands over — two kinds and one
question, where gathering the general comparison alone reported nothing at all on `count(x) eq 0` or
`string-length(@x) eq 0` and so on the idiom half of any 2.0 stylesheet is written in, the scan
underneath having matched `(!=|<=|>=|=|<|>)` and no word at all (#763) — and asks three questions
the regular expressions underneath it could only approximate. **What the operands are**: a digit
compares against the call when it *is* the whole operand, which a tree says outright and a scan had
to bound by hand — `$max + 1 > count(x)` was reported until #573 spelled the arithmetic out, and
`count(x) > 0 + $n` with it. **What the call is**: the standard function of that name, told from a
user function of the same local name by the URI the prefix resolves to rather than by the prefix,
which a character class cannot do at all — `[^\w:.-]` refused every prefixed spelling and so missed
the `fn:count` of any 2.0 stylesheet, while an inline `Q{urn:mine}count` walked straight through it,
the `}` in front of the name being no letter (#577). **What the arguments are**: the nodes the parse
separated, so a comma binding a `for` clause is no separator —
`count(for $va in a, $vb in b return $va) = 0` is reported and fixed again, the gap
`count-with-a-binding-clause` pins — `BINDINGS` in `test/expressions.test.js` pinned it while a
check still counted commas, and went with `lone` at #596 — and a gap around one is no operator,
`string-length( @x )` carrying the same lone operand the tight spelling does where a space read as a
binary operator withheld the rewrite from it (#578). Three regular expressions and the `masked`
blanking went with the text: a call standing inside a string literal is invisible because a literal
is one node, not because anything blanked it.

## `src/booleans.js`

`coerced(found)` — every node of the record's tree standing where nothing but its effective boolean
value is taken, each paired with whether an expression that binds loosely may stand there as it is;
and `unwrapped`, the text that may replace such a node once only its argument's value carries over.
The question `redundant-boolean-call` and `redundant-double-negation` share, and the reason they
moved together: a `boolean(x)` is redundant exactly where `not(not(x))` reduces to a bare `x`, so
migrating one alone would have `--fix` write the defect the other reports next (#561, #596). The
places it names are XSLT's own two, a whole `@test` and a whole `use-when` — SaxonJ-HE 12.5 includes
a template whose `use-when` wraps its test in `boolean(...)` exactly as it includes the bare
spelling, and excludes both `""` and `boolean("")` — and inside the expression XPath's: an operand
of `and` or `or`, the argument of `fn:not` or `fn:boolean`, the condition of an `if`, the body of a
`satisfies`. Neither attribute is version-gated, since below 2.0 a `use-when` is not XSLT's
attribute at all and such a stylesheet is broken for a reason of its own; the `xsl:use-when` a
literal result element spells instead is the same entry rather than a second one, `expressionsOf`
yielding a record for either spelling since #654 and `whole` reading the local name of an attribute
in the XSLT namespace, so the unprefixed name on the list answers for both and the prefix a document
binds never comes into it. A bracket of the author's own inherits whichever of them it stands in,
which is why the answer is walked from the root down rather than climbed to from a node: a span is a
range of token indexes and the tree carries no parent. A predicate is deliberately not one, though
it coerces: XPath reads a numeric predicate as a test on the context position, and SaxonJ-HE 12.5
answers `item[boolean(count(e))]` with both items of a two-item document where `item[count(e)]`
answers the first alone, so what the wrapper hides there is the difference between a truth and a
number. Nor is an operand of a comparison, which compares the values themselves. Only an `and`/`or`
operand needs brackets round what arrives, everything else on the list standing inside brackets
already or with nothing behind it, and `tight` answers that off `LOOSE` — one rung tighter than the
operator it is asked about, so a comparison carried into an operand is bracketed where it need not
be. That is one ladder borrowed rather than a second one kept in step with the grammar, and brackets
nobody needs are noise where a missing pair is a rewrite that means something else.

## `src/expressions.js`

`enclosed` — the expressions an attribute value template holds in its braces, and since #557 the
whole of what this module is for. `masked`, which blanks every kind `OPAQUE` names, is private to it
now and `closes` is gone: six checks scanned above them and each is on the tree, #577 taking
`comparedToZero` there, #575 the predicate scan, #596 and #561 the two negation checks, #598
and #562 the name and translate scans, and #557 the node-set one — where a literal is one node and
nothing needs blanking to be read over. The module survives its last check because the brace scan is
text work by nature rather than a scan that had not been migrated yet: an attribute value is not
XPath, so where its expressions begin and end is a question about the value, and a `{` standing
inside one of them is what `masked` is still blanking. `lone` went with the negation pair, the only
readers it had left: it answered whether exactly one argument stood between a call's brackets by
counting the commas at depth zero, which a parse answers by separating the arguments. Two things it
could not do went with it. A binding clause puts its commas at depth zero inside *one* argument, so
`not(not(for $va in a, $vb in b return $va))` went unreported — the gap `BINDINGS` pinned in
`test/expressions.test.js` until the checks reading it came onto the tree, and a pack of each pins
the construct now, the way `count-with-a-binding-clause` has since #577. And a bracket holding only
a literal is not an empty bracket, which the masking hid: `count('abc')` blanked to a gap, so no
emptiness test could tell an absent argument from a blanked one and the three checks fell silent on
`count('abc') = 0`, `boolean('abc')` and `not(not('abc'))`. Arity stays a question each check asks
by name — `fn:count`, `fn:not` and `fn:boolean` take exactly one argument in every version and
`fn:string-length` none or one — and `children.length` over the parse is what answers it, where
`count()` was reported as a count of a node-set and `not(not())` as a double negation, both carrying
a **safe**-tier fix that plain `--fix` applied, so `test=""` was written and the next run reported
the `invalid-xpath-expression` the last one had manufactured (#576). The parse gate in `defect`
could not have supplied that: it withheld a fix only where the engine refused the expression, and
fontoxpath's `compileXPathToJavaScript` resolves no signature, so every one of those calls is valid
text to it. Nor can the engine be asked one call further — `evaluateXPath` does raise `XPST0017`
statically, but against a registry that is not the XSLT one: 26 of 28 XSLT 3.0 functions and 14 of
29 XPath 3.1 ones are absent from it, `current()`, `key()` and `document()` among them, so a check
reading that verdict would report the commonest calls in a 1.0 stylesheet as errors.

## `src/tokens.js`

Positioned XPath lexer (`tokenized`, `TOKENS`), preserving whitespace. A name is lexed whole and
greedily as `TOKENS.NAME`, so the operator letters inside one stay part of it — `border` is one
token, not `b`/`or`/`der` (#617, #249) — and a word is an operator only where the grammar lets one
stand, which `operates` decides from the last token rather than from the spelling: the `or` of
`a/or` is a node test, the `or` of `a or b` is not. `WORDS` and `SYMBOLS` are derived as complements
of each other from the same operator maps. Every piece of punctuation carries a kind of its own too
— `/`, `//`, `@`, `$`, `,`, `.`, `..`, a `::` no axis name claimed, and the operators XPath 3.1
added (`=>`, `:=`, `!`, `#`, `?`, and the braces and `:` of a map constructor) — so `TOKENS.OTHER`
holds only what XPath has no token for at all, rather than the undivided run that lexed `a/@b` as
one `other` and left nothing a recursive-descent grammar could be written against (#676, #685). The
arrow was the sharper of the two, and the distinction is worth keeping: a *missing* kind lands in
`OTHER`, where a reader knows it has met something it cannot name, but `=>` was absent from `DOUBLE`
where `>=` already sat and so lexed as `=` then `>` — a stream read wrongly rather than not at all,
`a => f()` arriving spelled exactly like `a = (> f())`. The node comparisons were that same absence
one more time: `<<` and `>>` were missing from `DOUBLE` where `<=` and `>=` already sat, so
`$a << $b` arrived as two `<` in a row, and `is` was missing from the word half beside `eq` and `or`
(#724). One entry each is the whole of the lexer's share, since `WORDS` and `SYMBOLS` are derived
from that map — `is` is an operator only where `operates` admits one, so the `is` of `foo/is` stays
the node test it is, and `island` stays one name. Every entry is one word now: `instance of` is two
with a gap between them, which a name scan cannot reach past, so the lexer carried a branch of its
own to match it and every name it read had to ask whether a longer spelling stood there. The grammar
reads that one by value instead, `instance` then `of`, exactly as it has always read `cast as`,
`castable as` and `treat as` — which took `opensMore`, the `spelled` branch and the `INSTANCE_OF`
kind out with it, and let `xs:integer? instance of x` be the expression every processor reads it as
(#742). The word→kind lookup that is left is `worded`, exported for the grammar rather than spelled
twice. A braced URI literal is one token too, for a different reason than an operator is:
`Q{uri}local` is how XPath 3.0 writes a name's namespace inline, and `BracedURILiteral` is a
*terminal* of the grammar, so the whole of `Q{…}` is lexed here rather than assembled above out of a
name and two braces — which is what it arrived as, six tokens of which one was the `{` a map
constructor opens with, so a production written against either had to reach inside the other's. A
malformed one is not a kind of literal: the content is every character up to the closing brace with
a brace itself excluded, so `Q{a{b}c` and one that never closes lex on as the `Q` and the brace they
always were, and the grammar refuses what those tokens make rather than a new kind having to say so
(#708). A literal that never closes is `TOKENS.UNCLOSED` and not a `STRING`, for that same reason:
`'unclosed` came back as a finished literal, so the lexer supplied the quote its author never wrote
and the grammar accepted an expression no processor parses (#708). A comment that never closes is
`UNCLOSED` too, and it took one ticket longer to say so, in the function directly beside it:
`afterComment` answered an offset alone and the caller kinded every run a finished comment, so
`a (: b` came back as a step and a comment — and a comment is *trivia*, so the grammar read over the
whole tail and had nothing left to object to, while the six scanners reading tokens saw nothing
after the `(:` either. One mistyped `:)` and a file linted clean, `a (: note | child::b` drawing
neither the `invalid-xpath-expression` it earns nor the `unabbreviated-axis` that `a | child::b`
draws (#752). Both answer `{at, closed}` now, and an unfinished run of either kind is one
`UNCLOSED`: opaque to every scan that must read over it, and outside `TRIVIA`, so the grammar meets
a token it cannot name and refuses at the offset the quote or the `(:` stands at. Nothing follows
such a token, either kind of unfinished run reaching the end of the input by construction, which is
why the last-solid-token questions below are unaffected by its arriving solid. Which kinds carry no
meaning to a grammar and every meaning to the source is `TRIVIA` — a gap and a comment — and it is
one list for exactly the reason below, having been spelled four times over: as `TRIVIA` in
`src/grammar.js`, as a `&&` chain inside `tokenized` deciding the last solid token, as a `filter` in
`src/linters/predicate-position-linter.js`, and once more in `lone`. Its own `no-restricted-syntax`
selector refuses a second copy, and it found that fourth one. Two readers are left, in
`src/grammar.js` and in `src/syntax.js`'s `parting`: that linter reads no token at all since #575
took it onto the tree, where trivia is the grammar's business and a predicate arrives already
knowing what it holds, and `lone` was deleted with the last two checks counting a call's arguments
by hand (#596, #561). Which kinds a scan must read *over* rather than into is `OPAQUE` — string,
unclosed and comment together — and it is one list because the two readers of that question,
`masked` in `src/expressions.js` and `inside` in `src/linters/xpath-format-linter.js`, each spelled
it out and so a kind added to one was a kind missing from the other: it was, and
`redundant-double-negation` and `count-compared-to-zero` reported inside `select="'not(not(x))"`, on
text nobody evaluates. A `no-restricted-syntax` selector refuses a second copy anywhere in `src/`
but `src/tokens.js` itself, which is exempted by filename rather than by naming every kind: an array
or a `&&`/`||` chain mentioning `TOKENS.STRING` beside `TOKENS.COMMENT` is the list spelled out
again, whether or not it happens to be complete today. Both readers spelled it as a chain, not an
array, so a selector reading `ArrayExpression` alone would have matched a shape this repository has
never held and passed the two it did. Which kind each of the thirteen axes is lexed as is
`AXIS_KINDS`, derived from the axis map and exported for `test/strictness.js`, which reads a spaced
separator off it rather than writing the thirteen down again. Which of them ends a value is `ENDS`,
so `operates` reads kinds alone: `.`, `..` and a constructor's `}` end one, and the `or` of `. or x`
is therefore an operator. A colon runs a name on only where an NCName can start behind it, which is
`joins`, and that one rule is every question the lexer had about a colon. It ends a name at a `::`
with no clause of its own, a colon opening no NCName either: reading them as name characters is how
`a::b` arrived as the single token `a::b` while `a ::b` arrived as three, one grammar read two ways
by a gap, with the separator nowhere in the first for a parser to object to — six invalid
expressions parsed as a plain step until it was fixed (#703). And it ends one at the `:` of a map
entry for that same reason, a space and a digit opening no name, where taking every colon on sight
swallowed the separator into the key in front of it: `map{a: 1}` came back with `a:` as one name and
`map{a:1}` with the whole of `a:1`, so ten of fourteen key spellings were refused where fontoxpath
and Saxon-HE 12.5 both accept them — the glued form every real map is written in, while the spaced
`map{a : 1}` parsed all along (#746). A separator ends a name and settles what may follow it: the
grammar admits a NodeTest there and nothing else, so a name behind one is the element it names
however it is spelled, and `child::child::b` and `child:: child::b` arrive as one stream rather than
two told apart by a space (#709). That question is about what precedes rather than about characters,
so it is `operates`'s question and answered beside it: both are handed the last *solid* token, which
`tokenized` carries forward as it pushes. Only one of the two cares whether a gap stood there, and
the claim that neither did was wrong: XPath makes whitespace or a comment stand between two
terminals that cannot delimit each other, so `1div 2` and `1eq 2` are syntax errors where `1 div 2`
and `1(: c :)div 2` are not, and `operates` takes that as its second argument. `GLUES` names the
near side of the pair — a number, and a name for completeness, since a word run against one is
absorbed into it and `adiv` arrives as the single name it spells — and it is the *only* place a gap
decides what an expression is made of rather than merely how it is written, which is why `separates`
still reads the token alone (#742). Handed the token and not the list, because this one is asked of
*every* token where `operates` is asked only of a word — deriving the last solid token by filtering
the whole list each time turned the lexer quadratic in allocations, 3.4x on a 200-step expression,
which is the shape #687 and #689 were each a ticket about. The character walk in `opensAxis` had
been answering it by accident, asking `spelling` whether a name was in progress, which counts a `:`
as a name character: the tight form walked back over the separator and got the right stream for the
wrong reason, and the spaced form stopped at the gap and opened an axis. No verdict rode on it,
since nothing accepts either spelling; the message did, and a parser handed two axis tokens said
`expected a name, found "child::"` — naming a token the author never wrote as one. Also owns the one
definition of a gap — `WHITESPACE`, the XML `S` a gap is spelled with, and `GAP`, the same four
characters as a regular-expression class — plus `spelling`, which answers whether a name runs up to
an offset, and `qualified`, which answers whether XML can spell one at all. Those two are different
questions and the second was nobody's: a name was taken whole and greedily, so `my:25l`, `my:-x` and
`my:a:b` each arrived as one `NAME` and read as an ordinary step, the grammar asking the lexer for a
name and never how it is spelled — the one place we were the lenient side of the engine (#708). What
is left for it to answer is the `USER_FUNCTION` kind, whose own scan takes an ASCII run in front of
a bracket and weighs neither part as an NCName, so `my:25l(3)` still arrives whole; a bare `NAME` is
a QName by construction since #746, and the `REFUSES` row spelling that call is what keeps the
answer reachable at all. A QName is an NCName or two joined by one colon, and each part is weighed
with `NAMED` less the colon that split it and `STARTS` for what it may open with, so the answer
borrows the classes the lexer spells a name with rather than holding a second opinion about what a
letter is. Those classes are what has to be right, then: `NAMED` was XML's `NameChar` less its three
extenders — the middle dot and the two ties, `\p{M}` already covering the combining marks — so `a·b`
was refused where the engine and both arbiters accept it, eight spellings in all (#731). They are
name characters and nothing more, none of them able to open a name, which is `STARTS`'s answer and
unchanged. Both parts must hold something: a prefix names nothing on its own, and `$my:` and
`my:(1)` are refused by every engine. This answer let them through, permitting a trailing colon
because the `my:` of `my:*` arrives spelled that way — the `*` being the wildcard's own token — so a
permission a wildcard needed reached a variable and a call as well (#731). A wildcard is `tested`'s
business and it takes the tokens of the prefixed spelling itself now, which leaves this answer
nothing to make an exception for — and since #746 no name the lexer hands over ends in a colon at
all, `my:*` arriving as the three tokens the grammar reads with the adjacency below. Every reader of
a gap borrows one of them, and a `no-restricted-syntax` selector bans `\s` outright, because
JavaScript's class also takes a no-break space and so reads a call in `boolean&#xA0;(a)` where no
processor sees one (#643).

## `src/grammar.js`

Its derivation stands at the top of `src/grammar.js` itself, one step further down than a directory
guide can reach: it is the dearest note this guide held, and it arrives now when that file is opened
rather than whenever anything under `src/` is (#821).

## `src/syntax.js`

Its derivation stands at the top of `src/syntax.js` itself, for the reason the note above gives
(#821).

## `src/import-graph.js`

Resolves `xsl:import`/`xsl:include` hrefs: `importsOf`, `graphOf`. A reference with no `@href` names
no module and yields no import, rather than joining a null onto the directory and taking the whole
run's report down (#597); no check reports that malformed reference yet (#668). Each import carries
the raw text of the file it stands in beside its node, because a fix that cuts one reads its span
from the source rather than rebuilding the element (#793).

## `src/fixers.js`

Maps a declarative check name to a `node => fix` builder, each built from `src/fixes.js` rather than
by hand: `deletion` for one that cuts an attribute, `substitution` for one that rewrites its value.

## `src/fixes.js`

Shared fix builders: `deletion(attribute, content)`, which reads the span to cut from the raw source
— xmldom reports an attribute at its opening delimiter, so the quote is whichever stands there and
the walk back over the `=` and the name crosses a gap of any width. Rebuilding the text as
`name="value"` behind a space made the fixer decline every other spelling of it (#594). Beside it,
`standsAt(attribute, content)` answers where an attribute *stands*, in the line and column a defect
is reported in, off the same walk: a reporter that instead subtracted the name's length from
`columnNumber` was right only where the source spelled the attribute `name="value"` exactly, so
`xmlns:dead = "urn:dead"` was reported two columns right of itself and one standing on its own line
six (#681). The two answers differ by one gap on purpose — a deletion takes the gap in front of the
name with it, or it would close two attributes up against each other.
`substitution(attribute, replacement)` is the third, for a fix that rewrites a value rather than
cutting it: it anchors one character past the delimiter and replaces the value alone, so the name,
the gaps around the `=` and the quote stay as the source spells them and none of the three has to be
found. Five builders rebuilt the whole attribute as `name="value"` instead, which assumed all three
at once and failed on each — on `select = "//para"` the fix named a column two to the right and a
text standing nowhere in the file, so it was announced and then declined as no longer matching
(#718). The arithmetic behind it is banned outright now by a `no-restricted-syntax` selector, since
nothing in `src/` needs to guess where an attribute begins. It does read the delimiter, though,
because what a fix carries is the *decoded* value: an expression the source spelled `//a[@x &lt; 1]`
arrives holding a bare `<`, and writing it back as it stands closes the element early. So `escaped`
re-encodes the `&`, the `<` and whichever quote the value stands in — the delimiter being the one
position the parser reports exactly, which is why `deletion` reads it too. A `>` is left bare, legal
in an attribute value: re-encoding cannot recover which characters the author chose to write as
references, so the line is drawn at what XML forbids. Rewriting the whole value swept every entity
in it before that, which master does today on the plain spelling and this change would otherwise
have carried to the spaced one. `excision(element, content)` is the fourth, and it cuts a whole
*element*: the tag closes at the first `>` standing outside an attribute value, so a `>` written
inside one is stepped over rather than mistaken for the end of the tag, and an element spelled the
long way ends at the `>` of its end tag instead — found only where the source between the two tags
is gap, since a comment holding a `</` of its own puts that search inside itself, and no fix at all
beats a span cut through the middle of something. Such a comment is legal XSLT rather than a broken
file, xsltproc and SaxonJ-HE 12.5 both honouring an `xsl:import` that holds one, so what is withheld
is a fix and not a report. What the cut takes beyond the element is `lined`'s question and one rule:
the whole line where the element owns it, indentation and line ending together, and the element
alone where anything else stands on that line, the indentation of a shared line belonging to the
line rather than to whichever element is cut out of it. `redundant-import`'s fix rebuilt the element
instead, as an indentation repeated `columnNumber` times and a tag spelled out of the name and the
href, which assumed a gap, a delimiter and an empty-tag spelling all at once. Of the eight spellings
one fixture now holds — a gap around the `=`, single quotes with a trailing gap behind them, a space
in front of the `/>`, the long form, a wider gap after the element name, an element wrapped across
two lines, one sharing its line with a sibling that survives, and one ending a line it does not own
— master applies **none**, each announced and then refused with "the source no longer matches", the
wording reserved for a span an earlier edit had moved, on a file nothing had touched (#793). A fix's
`value` cannot be spelled out at all now, a `no-restricted-syntax` selector refusing a template
literal or a concatenation under that key anywhere in `src/`: it is the text the source already
holds, and #718's ban saw only the subtraction it was written for.

## `src/fixer.js`

Applies a defect's `fix` to source (decode-walk, verify-before-apply, end-to-start). A line ending
in the source answers to a space in the fix's `value`, the last normalisation between the two texts,
without which no fix could reach an expression a line wrap crossed — announced as fixable and then
refused with "the source no longer matches", naming an edit that never happened (#629).

## `src/xpath.js`

The fontoxpath environment, and since #577 only that: prefixes, the two evaluators the declarative
loaders issue their selectors through, and `compiles`, the engine as it stands, exported for the two
sweeps that diff the grammar against it — a second opinion rather than a verdict, which is what lets
it stay strict where the specification is not. The front door moved out to `src/syntax.js`, which is
what #738 left half-done: it deleted the 204 lines of respelling that rewrote an expression before
the engine was asked about it, so what stayed behind was a verdict this file no longer had any part
in answering, sitting in the one module that loads a 3.1 engine. A check reading the tree would have
pulled fontoxpath in behind it for a question the grammar answers. Beside them
`satisfies(node, xpath)` asks the engine about one node and gets one boolean, which is the half of a
split selector a walk cannot answer: the axis comes off `named` — or, since #811, off `attributed` —
and the tail is asked of each candidate as `self::node()` followed by the predicates the selector
wrote, which an attribute answers as readily as an element, `node()` being the one node test that
matches both (#784, #811). `PREFIXES` is exported for that same change rather than copied into the
index, since a bucket keyed on what `xsl:` means here and a predicate asked of what it means to the
engine would be answering two different questions.

## `src/helpers.js`

XML parsing (expands internal-subset entities), YAML parsing, file recursion. `allFilesFrom` joins
each subtree on with `flatMap` rather than spreading it into a `push`, since a spread hands every
path over as an argument and V8 caps those at roughly 125 per kilobyte of stack: this repository's
own checkout grew to 768,731 files and every run over it died with a `RangeError` before a byte of
XSL was read, the walk being asked before anything is filtered for `.xsl` (#758). It refuses what
`@xmldom/xmldom` would repair rather than reject: the level of a diagnostic is not consulted, since
an attribute written without quotes arrives a mere `warning` and is then invented into a value
(#574), and `forbidden` walks the text nodes for the two sequences character data may not hold — an
`&` that opens no reference, which the parser rewrites to `&amp;`, and a `]]>` that closes no
section, which it keeps as it stands (#691). Both are accepted in silence, at no level. Text nodes
come from `src/tree.js`'s `walked`, not from a scan of the source, because both are legal in a
comment and a processing instruction, and inside a CDATA section an `&` is text while a `]]>` is the
close — a text node cannot be any of the three, so those are excluded by construction rather than by
finding them, and an attribute value, where `]]>` is legal because it is not content, is outside the
walk for the same reason. The YAML parser is required inside the function, not at the top: nothing
on the linting path reads YAML any more, so a run that has no `.xslint.yml` never loads it.

## `src/resources/checks.json`

Every check as a run reads it, built from the YAML by `scripts/generate-checks.js`. Never edited by
hand — `test/conformance.test.js` re-renders it and fails on any difference.

## `src/logger.js`

4-level logger.
