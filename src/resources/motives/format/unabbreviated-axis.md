# Can use abbreviated axis specifier

`child::chapter/attribute::id` selects exactly what `chapter/@id` selects, so a
codebase holding both leaves readers asking how they differ and hides the
longhand from a search for `@id`. Keep to the short forms, the idiom nearly all
XSLT uses. A team that writes `child::` for emphasis turns this check off.

Incorrect:

```xsl
<xsl:value-of select="child::title"/>
<xsl:value-of select="attribute::name"/>
<xsl:apply-templates select="parent::node()"/>
<xsl:copy-of select="self::node()"/>
```

Correct:

```xsl
<xsl:value-of select="title"/>
<xsl:value-of select="@name"/>
<xsl:apply-templates select=".."/>
<xsl:copy-of select="."/>
```

Only these four have a short form. In a pattern only `child::` and
`attribute::` are flagged. On XSLT 1.0, `.[1]` is a syntax error, so write
`(.)[1]` for `self::node()[1]`.
