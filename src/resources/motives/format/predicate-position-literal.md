# Positional predicate written the long way

`foo[1]` means `foo[position() = 1]`, and `foo[last()]` means
`foo[position() = last()]`. Two spellings of one selection hide each other from
a search, so keep the bare number, the idiom XSLT uses.

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

Either operand order is flagged, with `=` or `eq`. A predicate that asks more,
such as `[position() = 1 and @current]` or `[position() > 1]`, keeps its
`position()`.
