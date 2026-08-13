# Positional predicate written the long way

A predicate that holds a single number is, by definition, a test on the
context position: `foo[1]` means `foo[position() = 1]`, and `foo[last()]` means
`foo[position() = last()]`. Spelling the `position() =` out adds nothing — it is
the same selection, just longer to read.

The equality is what makes it redundant, and it counts in either class XPath
spells equality in. `[position() eq 1]` compares two `xs:integer` values and is
true at exactly the position `[1]` is true at, so the word spelling abbreviates
the way the symbol one does. Either operand order reads the same
(`[1 = position()]`, `[last() eq position()]`), and the call is the standard
`fn:position` or `fn:last` however its namespace is spelled — bare, or behind a
prefix bound to the XPath functions namespace. A function of your own that
borrows one of those local names is another function and is left alone.

A predicate that asks anything else keeps its `position()`, which is
load-bearing there. `[position() = 1 and @current]` is a boolean test, and
`[1 and @current]` is a different one. `[position() > 1]` spans every position
but the first rather than naming one. And `[position() = '1']` compares against
a string, where the abbreviation `['1']` holds a non-empty string and so is true
at every position instead of the first.

Incorrect:

```xsl
<xsl:value-of select="item[position() = 1]"/>
<xsl:apply-templates select="row[position() = last()]"/>
<xsl:value-of select="cell[position() eq last()]"/>
```

Correct:

```xsl
<xsl:value-of select="item[1]"/>
<xsl:apply-templates select="row[last()]"/>
<xsl:value-of select="cell[last()]"/>
```
