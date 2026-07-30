# Using namespace axis

The `namespace::` axis is deprecated in XSLT 2.0 and stays deprecated in 3.0 —
some 3.0 processors drop it entirely. Use the standard functions
`in-scope-prefixes()` and `namespace-uri-for-prefix()` to inspect namespace
bindings instead. In XSLT 1.0 the axis is not deprecated and is not flagged, so
this check fires only on a stylesheet declaring version 2.0 or 3.0.

The axis is caught in every XPath and pattern attribute of an XSLT element — a
template `match`, a `select`, a `test`, a `use` — not only in `match`/`select`,
and inside an attribute value template, where `&lt;div id="{namespace::*}"/&gt;`
holds an expression as surely as a `select` does. An attribute of the output
vocabulary that merely shares one of those names carries text for the result
tree, not XPath, so it is left alone. Because the expression is tokenized, a
`namespace::` inside a string literal is left alone too, and the lookalike
functions `in-scope-prefixes()` and `namespace-uri-for-prefix()` are never
mistaken for the axis.

Incorrect:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:template match="*">
    <xsl:for-each select="namespace::*">
      <xsl:value-of select="."/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:template match="*">
    <xsl:for-each select="in-scope-prefixes(.)">
      <xsl:value-of select="namespace-uri-for-prefix(., current())"/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
```

Rewriting the axis to those functions is a structural change, not a one-span
edit, so this check reports without a `--fix` until the full-fidelity parser
(#228) lands.
