# `src/validators/` — module notes

The two stages that partition the input before a linter sees it. The staging itself is in
the root `CLAUDE.md`.

## `src/validators/xsl-validator.js`

Builds the corpus; reports each non-well-formed stylesheet. What "well-formed" means is
`xmlFromString`'s rather than `@xmldom/xmldom`'s, which both repairs faults of its own accord and
refuses documents every processor loads: eight stylesheets of the three corpora were reported here
for an entity name holding a dot or a byte order mark opening the file, and the derivation of both
answers stands under `src/helpers.js` and `src/source.js` in `src/CLAUDE.md` (#877).

What it hands on is the stylesheet a processor compiles, not the one written: an element whose
`use-when` is false before anything is evaluated — `false()`, `()`, a numeric literal equal to
zero or an empty string literal (#1057) — in any of the four spellings an XSLT element or a literal
result element gives it, is removed with everything under it. A selector judging the text as written
reported an `empty-choose` on a `choose` Saxon-HE 12.5 never compiles, and stayed quiet on one whose
only `when` it excludes, which Saxon refuses as XTSE0010. The attribute is XSLT's from 2.0 on and a
shadow from 3.0, at the version in force: xsltproc compiles an `xsl:if` carrying `use-when="false()"`
in a 1.0 sheet and refuses the `xsl:sequence` inside it, so pruning there hid the defect it hits.
Any other condition, `not(true())` among them, is left standing, its answer being a processor's,
and so is the root, a document with no element being one nothing reads.
The pack harness builds its corpus here too, so a pack reads what a run reads (#1048).

## `src/validators/xpath-validator.js`

Splits the corpus's expressions into valid (kept) and refused (reported), asking `parseOf` about
each record `expressionsOf` yields — the same derivation the code-based linters read, rather than a
walk of its own over a list of attribute *names* got by subtracting the pattern-holding ones from
`ATTRIBUTES`. That subtraction reached 286 of this repository's 453 expressions, so a `match` no
grammar accepts, a `{1 +}` in an attribute value template, a 3.0 text value template and a shadow
attribute were validated by nothing at all, while the code-based linters — staged over the whole
corpus — read those same expressions and reported what they found in them, with only `defect`'s
parse gate keeping a fix off it (#589). One expression stayed outside both readings until #654, the
derivation itself having missed it: the `xsl:use-when` of a literal result element, which is a
static expression a processor evaluates before it transforms anything and the only spelling of that
attribute a simplified stylesheet has. What it keeps is what all thirteen expression linters are
staged over since #750, so a refusal reported here is the only defect that fault draws.

A refusal is two defects and not one, and what parts them is the version in force. Text no
version of the language admits is `invalid-xpath-expression`; syntax a later version does admit is
`syntax-newer-than-xslt-version`, which is #631 answered under a name of its own rather than sharing
one with a mistake. The measurement is eo's `parse/add-default-package.xsl:92`, which declares
`version="2.0"` and matches `metas/meta[head = 'also']/(tail|part)`, a parenthesized pattern step
XSLT 3.0 introduced when it rebuilt patterns on the expression grammar. Saxon 9.1.0.8, being 2.0
only, refuses it as XTSE0340 at the very offset reported here; Saxon-HE 12.5 runs it whatever the
sheet declares, XSLT 3.0 §3.9.2 having a processor read the 2.0 it promises exactly as if it said
3.0. So the file works everywhere its author tried it and breaks on a conformant processor of the
version it names, and one message calling that malformed, unparsable and a syntax fault to fix was
wrong about what it is, where the fix goes, and how bad it is. The motive already conceded as much,
the fix being sometimes the stylesheet's `version` rather than the expression, while the message
beside it said otherwise; a contradiction between the two is what a user reads as the tool being
confused (#925). Which of the two a refusal is, `raised` decides by asking `isValid` at each `KNOWN`
version above the one in force: a refusal any of them accepts is the mismatch. That rests on the
grammar being monotonic, which is measured rather than assumed, no one of the 14112 shapes
`test/grammar-shapes.test.js` generates being accepted at a lower version and refused at a higher
one, in `parsed` or in `matched`. Where nothing over the node declares a version, or declares one
`versionOf` cannot place, there is no version above it to ask: `parseOf` has already read the
expression at the most permissive version this tool knows, so the refusal is the text's own and
falls through to the first check. What does not change is the partition. The expression is still
dropped rather than handed on, because `parseOf` memoises on the version in force and #732 made that
the version that judges; escalating it to keep the expression would undo that ticket, and advice
about a construct the declared version will not load is advice about nothing. Only the complaint
changes, and the two checks suppress independently.

The defect goes through `defect` in
`src/checks.js` rather than being built by hand, so it stands at the offset the refusal carries
instead of at the attribute's opening quote — which the widening makes necessary rather than merely
nicer, two braces of one attribute value being two expressions that would otherwise report one
column.
