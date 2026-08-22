# `src/validators/` — module notes

The two stages that partition the input before a linter sees it. The staging itself is in
the root `CLAUDE.md`.

## `src/validators/xsl-validator.js`

Builds the corpus; reports each non-well-formed stylesheet.

## `src/validators/xpath-validator.js`

Splits the corpus's expressions into valid (kept) and malformed (reported), asking `parseOf` about
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
staged over since #750, so a refusal reported here is the only defect that fault draws. A pattern
illegal before XSLT 3.0 comes with it, which is #631: `matched` has refused one since #723 and had
nobody to say so. The defect goes through `defect` in `src/checks.js` rather than being built by
hand, so it stands at the offset the refusal carries instead of at the attribute's opening quote —
which the widening makes necessary rather than merely nicer, two braces of one attribute value being
two expressions that would otherwise report one column.
