# Sort not first

`xsl:sort` declares the order of the sequence its `xsl:for-each` or
`xsl:apply-templates` iterates, so it must stand ahead of the content that
iterates over it. One that follows an instruction is invalid: a processor
rejects it, and some silently ignore it, so the output looks unsorted for no
visible reason.

An `xsl:with-param` is not that content. Inside `xsl:apply-templates` the
content model is `(xsl:sort | xsl:with-param)*`, so the two stand in any order
and a parameter ahead of a sort is correct XSLT, whatever it looks like.
`xsl:for-each` takes no parameters at all, which is where the rule bites.

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

Correct as well, and left alone:

```xsl
<xsl:apply-templates select="item">
  <xsl:with-param name="depth" select="1"/>
  <xsl:sort select="@name"/>
</xsl:apply-templates>
```
