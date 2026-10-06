# Scans whole document

A path opening with `//` walks the entire document from the root every time
its expression runs, which in a template applied per node is once per node.
The author usually meant something narrower. Name that path, look the value up
with `xsl:key`, or bind the scan once in a top-level variable.

Incorrect:

```xsl
<xsl:template match="section">
  <xsl:for-each select="//item">
    <xsl:value-of select="."/>
  </xsl:for-each>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="section">
  <xsl:for-each select="item">
    <xsl:value-of select="."/>
  </xsl:for-each>
</xsl:template>
```

A `//` in a top-level `xsl:variable` or `xsl:param`, or in the template matching
`/` with neither `@name` nor `@mode`, runs once and is left alone. A `//`
opening a path in a pattern's predicate is reported too.
