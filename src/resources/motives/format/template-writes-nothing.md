# A template that writes nothing

A template whose only children are `xsl:variable` declarations computes values
and throws them away, so applying it adds nothing to the result and no
processor says so. It is almost always a half-finished edit: the variables set
up output that was removed or never written. Write that output, or empty the
template if it is meant to suppress the nodes it matches.

Incorrect:

```xsl
<xsl:template match="section">
  <xsl:variable name="heading" select="title"/>
  <xsl:variable name="count" select="count(item)"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="section">
  <xsl:variable name="heading" select="title"/>
  <xsl:variable name="count" select="count(item)"/>
  <h1><xsl:value-of select="$heading"/></h1>
  <p>Items: <xsl:value-of select="$count"/></p>
</xsl:template>
```
