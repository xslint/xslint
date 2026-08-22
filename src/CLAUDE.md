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
defect two buckets of *one* axis had before #784 merged them this way. A union is served whole or
not at all, a branch left to the engine needing the two answers merged across a sequence one side
never enumerated; and a union of **attribute** axes is refused for a reason of another kind — the
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

`parsed(xpath, version)` — the XPath 3.1 expression grammar as recursive descent over `tokenized`,
one function per production. A node's span is a range of *token indexes*, never a pair of character
offsets, so a position is carried from the lexer rather than computed from text, and the text of a
node is the tokens of its span joined back together. The whole stream comes back with the tree,
trivia and all, so joining it reproduces the expression as written — which is what keeps a fix a
span replacement over raw source. The version in force is a parameter rather than a lookup, because
the same text is a different language under a different one: `a to b` is a range in 2.0 and two
steps around a name in 1.0, so modern syntax in a 1.0 stylesheet is a parse failure rather than an
entry on a list somebody has to keep current (#652). The node comparisons are gated that way too:
`is`, `<<` and `>>` stand beside the value and general comparisons and are refused below 2.0, the
version that added them, so one selector of this project's own — the `$var << .` of
`confusing-variable-and-node` — stopped being valid XPath our own parser refuses (#724). Beside
them, and not below them: the three classes are one level of the ladder rather than three, because
`ComparisonExpr` takes an operand from either side of one operator and admits no run of them (#726).
Two levels of the ladder are spelled out rather than folded for that reason — the range between the
sums and the comparisons, and the comparison between the concatenations and the `and` — since a
`folded` run is left-associative and takes as many operands as it is offered. That associativity is
why one production is one rung of `LADDER` and every spelling it takes stands on that rung: three of
them were two rungs apiece until #764, split so a spelling could carry a kind or a floor the other
had not got — the word `union` above `|`, `idiv` above the other multiplicatives, `except` above
`intersect` — and a rung is what decides how tightly an operator binds, so the split made the second
of each pair the looser and nested a mixed run to the right. `9 idiv 2 * 3` came back
`9 idiv (2 * 3)`, which is 1 where XPath computes 12, and `a except b intersect c` selected what
`a except (b intersect c)` selects; a `RUNS` row in `test/grammar.test.js` now asks of every mixed
pair that its left operand covers the first operator. The kind names the production, as `sum` has
always covered a `-`, and a spelling younger than its rung carries its floor in `SPELLS` — asked of
the operator ahead rather than of the node about to be built, since both spellings of a union build
a `union` and `SINCE`, keyed on the kind, can only speak for the rung as a whole. Three rungs let a
comparison chain onto another, so `a = b eq c` and `a < b < c` parsed; over the 225 pairs fifteen
comparison operators spell, the engine accepts none and the grammar accepted 144. The node
comparisons would have taken that to 225, which is how the defect surfaced: the 81 pairs holding one
were refused because the lexer did not know the operator, not because the grammar was right, and
fixing the lexer took the accidental cover off. No committed expression chains comparisons, so the
corpus gate cannot see any of it and four `REFUSES` rows pin it instead, one per class and one
crossing two. A name with a bracket behind it is read off one table, `RESERVED`, which maps each
name XPath has taken to the version that took it, what it was taken for, and the production that
reads its brackets — a `test` (a kind test, standing where a node test stands), an `item` (an item
type, standing in a sequence type and nowhere a node test does) or a `keyword` (`if`, and the
`switch` and `typeswitch` this grammar has no production of). 1.0 takes the four node types alone,
2.0 adds its kind tests with `empty-sequence`, `if`, `item` and `typeswitch`, and 3.0 adds `array`,
`function`, `map`, `namespace-node` and `switch`. `reserves` asks whether the version has taken the
name at all, which is the whole of what a *call* needs to know, and `taken` asks whether it was
taken for one of the kinds a particular production will accept. The brackets themselves were
*counted* rather than read until #753 — `kinded` walked to the matching `)` and let anything at all
stand inside — so `text(a)`, `node($v)`, `element(1)`, `element(a b)` and `element(a, xs:string*)`
all parsed, in a pattern as much as in an expression, where every processor answers XPST0003 and
since #739 that is a missing `invalid-xpath-expression` on a `match="text(a)"` no processor loads.
Each name reads its own now, one production per shape XPath spells: `closes` for the six that take
an empty bracket, `instructed` for a processing-instruction test, `elemented` and `attributed` for
the two that name a node and optionally its type, `declared` for the two `schema-*` that require a
declaration, `documented` for a document test's element-or-schema-element, and `paired`, `listed`
and `returned` for the map, array and function tests. The count hid an *under*-acceptance too, which
is the direction that invents a defect against working code: a function test's return type stands
behind its closing bracket, `TypedFunctionTest` requiring an `as` where `AnyFunctionTest` refuses
one, so the walk swallowed the arguments and `$v instance of function() as xs:integer` was refused
for text left over at the end. Which production reads which name is the table's third field rather
than a `switch` beside it, which is why the table sits below those productions instead of among the
version tables it began in: a name taken for a test or an item type cannot lack the production that
reads it, and a keyword has no such field. The arbitration is worth recording because a single
engine could not have settled it — fontoxpath refuses `element(a, xs:string?)`, which Saxon-HE 12.5
accepts and the specification spells, and it accepts a nillable `attribute(a, xs:string?)`, which
Saxon refuses with XPST0003 and the specification has no production for. Reading the arbiter's
*code* rather than its exit status is what tells the two apart from the eight rows where Saxon
answers XPST0008 or XPST0051 — a missing schema or an unknown type, static errors against text it
parsed — and xsltproc settles the one place the versions differ, XPath 1.0's `NodeTest` taking
`'processing-instruction' '(' Literal ')'` where 2.0's `PITest` adds the NCName, so
`processing-instruction(a)` is a syntax error in a 1.0 stylesheet and a name in a 2.0 one. The floor
is half of what a name means, because below it the same characters are an ordinary call to a
function so called — unregistered, which is #576's question and not the parser's, and exactly what
xsltproc answers at 1.0 about every name in the table: it parses the expression and then goes
looking for the function. Two version-blind lists sat beside the floors until #728, the same fact
written twice with the version in one copy only, so `element(a)` came back a `step` in a 1.0
stylesheet where a 1.0 processor reads a call. The verdict agreed and the tree did not, which is the
half an acceptance diff cannot see — #708 measured against fontoxpath, an XPath 3.1 engine, and
every one of these agrees with it at 3.1 — and the half Phase 4 of #644 walks. So a `SHAPED` row in
`test/grammar.test.js` asserts the *kind* on both sides of a floor where neither side is a refusal,
beside a `RESERVES` row, which is the mirror of a `GATED` one: a construct that stops parsing from a
version up rather than starting. Applying an expression is gated the same way and was not gated at
all: `$f(1)` is a dynamic call from 3.0, when function items arrived, and before that the characters
are no call by another reading either, a `FilterExpr` taking predicates and no argument list — which
is how `child::element(b)` came back an `apply` at 1.0 the moment `element` stopped being a kind
test there. A name is taken only where a call could stand, in front of a bracket, so `//item` is the
path it always was. A refusal is an answer rather than an exception — a corpus asks about thousands
of expressions and most callers want a verdict — and it names the offset it stood at, so a report
can point at the fault instead of at the attribute holding it. An inline namespace is gated at 3.0
along with everything else that version added, and it reaches four productions rather than one, a
name being spelled in more places than a step: `named` composes the braced URI literal with the name
behind it, so a variable and a call get it for free; `tested` reads one standing in front of a `*`
as the fourth spelling of a wildcard, `Q{uri}*` naming every element of a namespace with no prefix
bound to it; `called` asks `pastName` where `reaches` cannot, since a name is one token spelled as a
QName and two with its namespace inline, so the bracket that tells a call from a step stands one
token away or two; and `steps` counts it among the kinds a step may open with, since a step opening
`Q{uri}a` opens with a name like any other. It asks that of `NAMES` rather than of one kind at a
time, the lexer kinding a name three ways — a bare `NAME`, a `USER_FUNCTION` where a prefixed one
has a bracket behind it, a `URI` where it spells its namespace inline. Asking about one kind is a
defect that repeated itself before the shape was seen: the first draft of #708 accepted
`a/Q{urn:my}b` and refused `//Q{urn:my}a`, the shape the inline form exists for, and with that fixed
`a/my:fn(1)` was still accepted while `//my:fn(1)` was refused (#731). Every production that *reads*
a name knew all three kinds; the one deciding where a name may stand knew them one at a time, and a
path is the only place that distinction shows. Under-acceptance is the direction that invents a
defect against working code. A reserved name is never either of those spellings, XPath reserving an
unprefixed one alone (#708). Beside it stands `matched(pattern, version)`, because a pattern is a
different language and not a second reading of this one: it is a union of paths and nothing else, so
`1 + 1`, `@a = "b"` and `a, b` are fine expressions and no pattern at all, and reading a `match`
with the expression grammar admits every one of them (#589, #649). The version decides which
language it is, by more than a detail: 3.0 rebuilt the pattern grammar on top of the expression one,
so `a intersect b`, `$v/x`, `doc("u")/a`, `root()/a`, `element-with-id("x")`, `(self::node())`, `.`
and the word `union` are all patterns there and none of them is one in 1.0 or 2.0, whose whole
grammar is `IdKeyPattern` and a union of relative paths — each is gated on `REWRITE` rather than
admitted everywhere, since a pattern accepted under a version with no production for it is a
stylesheet called valid that no processor loads. A `/` may stand alone and a `//` may not, the step
being what the descent descends to. A bracketed branch is where a pattern parts from an expression
rather than borrowing it: 3.0's `StepExprP` admits one at *any* position in a path, so `a/(b | c)`
is a pattern as much as `(b | c)/a` is, while the expression grammar's own parenthesized step may
only open a path (#711) — reading the two alike refused a pattern XSLT admits. Its steps are
narrower than an expression's at every version, because a pattern is matched by walking *up* from a
node rather than evaluated forwards, so an axis such a walk cannot answer is a static error and not
an empty match: `treads` names the two of 1.0 and 2.0's `ChildOrAttributeAxisSpecifier` and the six
of 3.0's `ForwardAxisP`, which adds `self`, `descendant`, `descendant-or-self` and `namespace`, and
no version admits the four reverse axes, `following`, `following-sibling` or `preceding-sibling`. A
`..` never spells a step and a `.` spells one from 3.0. Settling that took two processors and
neither would have done alone: SaxonJ-HE says what 3.0 refuses, with XTSE0340, but applies its own
3.0 pattern syntax whatever the stylesheet declares — it admits `self::a` and `.` at `version="1.0"`
— so only xsltproc, being 1.0 only, can say what an older version refuses. A processor shows that a
construct is admitted somewhere; only a version-aware one shows that a version refuses it, which is
the trap #717's arbitration fell into as well. Two more borrowings from the expression grammar are
paid back. A bracket is `bracketed` rather than the expression grammar's parenthesized primary, so
it holds a `Pattern` — optionally, since `()` matches nothing and is a pattern all the same —
`(a | b)/c`, `(a)`, `(a[1])/b` and `(a | b)[1]` are patterns and `(1 + 1)/a`, `(a = b)/c`, `("s")/a`
and `(a, b)/c` are not, though each of those is a fine expression. And `.` is the whole of
`PredicatePattern`, read by `whole` before any union, so it stands alone or not at all: `a | .`,
`. | a` and `.[@x] | a` are refused. It is still a *step* once a separator stands in front of it,
which is the distinction `entered` draws — `b/.`, `/.` and `//.` are patterns while `(.)`, `(.)/a`
and `a/(.)` open a path with one and are not. The last borrowing goes with them: `FunctionCallP`
took its arguments from the expression grammar, where XSLT admits a literal or a variable reference
and nothing else, so `key("k", a/b)`, `id("x" | "y")` and `doc(concat("a", "b"))/x` parsed as
patterns; `anchored` narrows them, and `root` takes no argument at all. A numeric literal is a
literal, so `key("k", 1)` is a pattern and `id(1)` is one too — a processor refuses that second one
for `XPTY0004`, which is `id`'s signature rather than the pattern grammar, and reading the arbiter's
*code* rather than its exit status is what tells the two apart. Eight of a first sweep's apparent
over-acceptances were static-type, undeclared-prefix, arity and classpath errors. A type is read by
three productions rather than one, because XPath spells three and they have three shapes: `kinded`
for the kind test of a `NodeTest`, `sequenced` for the `SequenceType` an `instance of`, a `treat as`
and a function's `as` take, and `singled` for the `SingleType` a cast takes. One function served all
three and took an occurrence indicator wherever it was called, so a step lost the `+` of
`text() + 1` to a type that has none, `$v instance of (xs:integer)` was refused where a
`ParenthesizedItemType` stands, and `1 cast as node()` was accepted where a cast makes an atomic
value (#740). Two more borrowings went with it. `postfixed` hung its `(`, `?` and `[` off whatever
`primary` answered, and `primary` answered a *step* when nothing else matched, so `a?b` came back a
lookup into a step and `@a(1)` a call applied to one — `StepExpr ::= PostfixExpr | AxisStep` is a
fork, and `opens` is now the whole of it, one predicate naming the same shapes `primary` reads. A
named function reference is a `PrimaryExpr` of its own on that reading, not a postfix, which is what
`referred` says. And the simple map came off the ladder: `ValueExpr` *is* a `SimpleMapExpr`, so `!`
binds tighter than the unary signs and far tighter than the four expressions taking a type, where a
rung of the ladder put it looser than all of them and `a instance of xs:integer ! b` parsed as a map
over a sequence type. Two questions the lexer cannot answer are answered here instead, both of them
about a word (#742). `counted` takes the occurrence indicator a type ends with and reads the word
behind it as the operator it spells, since the `?` of `xs:integer?` and the `?` of `$m?div` are one
character with one token of lookahead behind each: the first ends a value and the second opens a
lookup key, so a wider `ENDS` answers for the type and breaks the lookup, and only the production
being read can tell them apart. The `*` never needed it, `MULTI` already ending a value by spelling
the wildcard of `a/*` — an accident that made `item()* div 2` right for a reason no rule stated. And
`glued` refuses a keyword run against the terminal in front of it, the same gap rule `operates`
applies to the words the lexer kinds, for the ones it hands over as names: `1to 3`,
`1cast as xs:integer` and the `1else` of `if (1) then 1else 2` are all XPST0003 and every one of
them parsed. `glued` is `abuts` narrowed to the kinds `GLUES` names, so every question this file
asks about a gap is one adjacency test underneath, and `abuts` is the absence of a trivia token
rather than arithmetic over offsets — the stream being lossless, a gap or a comment between two
terminals is a token of its own. `welded` is the same question one token further out, `reaches` with
adjacency required, and the pair is what a *terminal spelled out of several tokens* needs: a
wildcard is the only one XPath has, `Wildcard` being marked `ws: explicit`, so `my: *`, `* :a`,
`*: a`, `* : a`, `Q{urn:my} *` and `a/my: *` are not loose spellings of one but XPST0003 in Saxon-HE
12.5, and `tested` read all six as wildcards because `take` and `expect` skip trivia everywhere
else, rightly (#736). Each of the three composite spellings asks for adjacency in its own condition
and none refuses on its own account, a `*` being a whole wildcard already: what a gap parts from it
is the next production's business, which is what leaves the `:` of `map {* : 1}` to the map
constructor it separates. Both are read by `isValid` since #732, which is Phase 3 of #644 opening —
in `src/xpath.js` then and in `src/syntax.js` now, where the parse is kept rather than thrown away
once its verdict is read (#577): a run's verdict on whether an expression is valid is this file's,
taken behind the two gates of #680 that `test/grammar-corpus.test.js` holds `parsed` to, and the
shape sweep of `test/grammar-shapes.test.js` beside them.

## `src/syntax.js`

The one door between a record and what the grammar makes of it, and where every check that reads a
tree begins (#577). `parseOf(found)` forks on the record — `matched` for a pattern, `parsed` for an
expression — at the version `versionOf` reads at the node, or at `ASSUMED` where it can place none:
the most permissive version `KNOWN` holds, derived rather than spelled, because a missing `version`
is already `missing-version-in-stylesheet`'s defect and letting it decide a syntax question would
answer one defect with an `invalid-xpath-expression` for every modern expression the file carries.
One parse per distinct expression, keyed by version and language as well as by text, since a corpus
asks about `.` and `@name` and `text()` over and over (#689); and the *tree* is kept now, where the
verdict alone was the cheaper bargain while nothing above asked for more, because a check that walks
it would otherwise parse a second time. `isValid` is that verdict with the complaint dropped, for
the two gates wanting a boolean, and `refusalOf` is gone — the offset the fault stands at comes off
the parse itself, which is what lets the validator point at the fault rather than at the attribute
holding it (#589). Beside them, what a check needs of a node: `tokensOf`, the tokens a span covers,
with `textOf` and `offsetOf` derived from it, so a position is the lexer's rather than anything
computed from text — and the tokens themselves because the tree gives one kind to what the lexer
told apart, a `literal` being a number or a string with only its token saying which, which is the
whole difference between `[position() = 1]` and `[position() = '1']` (#575);
`gathered(found, kinds)`, every node of one of the kinds, outermost first, a list rather than one
kind because a construct is often two of them — which two is `VALUED`, the general and the value
comparison, one list here rather than one per check for the reason `TRIVIA` and `OPAQUE` are one
each, with a `no-restricted-syntax` selector refusing a second copy anywhere in `src/` but this file
and `src/grammar.js`, where the kinds are minted and all three are named in the table deciding which
operator builds which; `operatorOf`, the operator standing between two operands, read off the
`parting` tokens the grammar consumed without building a node of its own and canonicalised through
`WORDED` — the one table pairing each general comparison with the word XPath 2.0 spells the same
question in, so `eq` reaches a classifier as `=` and one keyed on six symbols answers for twelve
spellings (#763). `test/syntax.test.js` holds that table to the grammar as it holds `LOOSE`, asking
of each pair whether the two spellings really do come back a `comparison` and a `value-comparison`,
and sweeping every word operator the lexer knows for one the pairing misses — the direction that has
actually moved, 2.0 having added all six words at once. A check needing to know which class it was
handed reads the node's kind, that *being* the answer: the count collapses to a call and carries no
operator either way, while the string-length rewrite carries one and writes back the family it was
given rather than moving a value comparison into the general one;
`calls(found, node, name, namespaces)`, whether a node is a call to that function, resolving the
prefix against `holding(found.node)` and admitting the bare, the prefixed and the inline `Q{...}`
spellings of each namespace it is given — the standard ones by default, since a function is its name
and its namespace together and most of the names a check asks about are XPath's own. A list rather
than one URI because some functions are declared in more than one: `node-set` is EXSLT's and
Microsoft's for the same purpose, so `use-node-set-extension` asks about both and a `node-set` of
the author's own answers no (#557); `stringOf(found, node)`, the string a literal holds — unquoted,
and with a doubled delimiter inside it read as the one character it spells — which is the question
`textOf` cannot answer, XPath spelling one string two ways and a check comparing the text seeing two
literals (#598, #562, #549); `variableOf(found, node)`, the name a variable reference holds, which
is the same shape of question one construct over — XPath lets a gap or a comment stand between the
`$` and the name, so `$ para` references `para` and the text of the span does not say so, while a
namespace stays part of the name, `$Q{urn:my}para` and `$my:para` each naming a variable `$para` is
not (#776); and `tight(node)`, whether a node's text can stand as an operand of a general comparison
with no brackets round it. Beside those, `filters(tokens, node)` — whether a node can stand as a
predicate asked of one candidate at a time, which is what a check served from `named`'s walk needs
of each predicate it wrote (#784): XPath reads a predicate whose value is a *number* as a test on
the context position, and a candidate handed over alone is a sequence of one where every position
test answers true. `FILTERS` names the kinds that cannot be a number, `BOOLEAN` the standard
functions answering `xs:boolean`, and `positional` walks for a `position()` or `last()` under the
node, either of which hides inside a `comparison` the kinds would pass. Two kinds are not on the
list because their kind does not settle what they answer: a `call`, `not(@a)` and `count(@a)` coming
back alike, which its name decides; and a `path`, which its **last step** decides, since from XPath
2.0 a path may end in a call answering an atomic value and `a/count(.)` is a number spelled as a
path. Reading a path by its kind served `[a/count(.)]`, `[a/(count(.))]`, `[a/count(.)[1]]` and five
more, each of which the engine answers with one node where serving answered every match.
`test/syntax.test.js` holds both lists to the grammar as it holds `LOOSE` and `STEPPED`. `ASSUMED`
is exported with it, a check's selector carrying no `version` of its own and being read at the most
permissive one for the same reason a stylesheet declaring none is. That last one reads `LOOSE`,
XPath's own ladder from the comparison up — the comma, the five `ExprSingle` expressions, `and`,
`or`, and the three comparison classes that cannot chain — and `test/syntax.test.js` holds the list
to the grammar rather than to its comment, taking one expression of every kind the grammar builds
and asking whether `<specimen> = ''` really does come back a comparison over the whole of it. Beside
it `stepped(node)` reads `STEPPED`, the same ladder from the other end: the kinds a `StepExpr` can
be, which is everywhere XPath binds most tightly and so everywhere a *call* stands. That is the
question a rewrite unwrapping a call has to ask, and `use-node-set-extension` was the one unwrapper
with no answer behind it, substituting the bare text of its argument and dropping the brackets the
call had supplied — `exsl:node-set($one | $two)/alpha` became `$one | $two/alpha`, which selects
`$one` beside the `alpha` children rather than them (#774). A `path` is deliberately outside the
list although it stands as a step: a predicate binds to the last step of one, so
`exsl:node-set(alpha/beta)[1]` is `(alpha/beta)[1]`, and a predicate is the one postfix a node set
can carry. The same sweep holds it to the grammar, asking of each specimen whether `b/<specimen>`
comes back a path whose far step is the specimen whole.

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
