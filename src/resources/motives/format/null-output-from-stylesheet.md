# Null output from stylesheet

A root-matching template whose only children are `xsl:variable` declarations
produces no output. The variables are computed but nothing is ever written
to the result tree, which is almost certainly a logic error. An empty template
that matches specific nodes to strip them — the "override to delete" idiom — is
not flagged; the template must actually declare a variable to qualify.

Incorrect:

```xsl
<xsl:template match="/">
  <xsl:variable name="heading" select="title"/>
  <xsl:variable name="count" select="count(item)"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="/">
  <xsl:variable name="heading" select="title"/>
  <xsl:variable name="count" select="count(item)"/>
  <h1><xsl:value-of select="$heading"/></h1>
  <p>Items: <xsl:value-of select="$count"/></p>
</xsl:template>
```
