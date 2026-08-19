# Are you confusing a variable and a node?

When a variable and a node share the same name, using the bare name in
`select` silently picks the node child rather than the variable.

Incorrect:

```xsl
<xsl:template match="/">
  <xsl:variable name="title" select="'Hello'"/>
  <xsl:apply-templates select="title"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="/">
  <xsl:variable name="title" select="'Hello'"/>
  <xsl:apply-templates select="$title"/>
</xsl:template>
```
