# Sort not first

`xsl:sort` declares the order of the sequence its `xsl:for-each` or
`xsl:apply-templates` iterates, so it must stand ahead of the content that
iterates over it. One that follows an instruction is invalid: a processor
rejects it, and some silently ignore it, so the output looks unsorted for no
visible reason.

Incorrect:

```xsl
<xsl:for-each select="item">
  <xsl:value-of select="."/>
  <xsl:sort select="@name"/>
</xsl:for-each>
```

Correct:

```xsl
<xsl:for-each select="item">
  <xsl:sort select="@name"/>
  <xsl:value-of select="."/>
</xsl:for-each>
```

An `xsl:with-param` may stand before a sort inside `xsl:apply-templates`, so
this is correct:

```xsl
<xsl:apply-templates select="item">
  <xsl:with-param name="depth" select="1"/>
  <xsl:sort select="@name"/>
</xsl:apply-templates>
```
