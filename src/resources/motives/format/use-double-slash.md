# Use double slash

A `//` step in a pattern matches at any depth, so `root//item` also takes an
`item` nested far deeper than meant as the document grows, and it hides the
structure the template expects. When you know the shape of the input, name the
path.

Incorrect:

```xsl
<xsl:template match="root//item">
  <xsl:value-of select="."/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="root/list/item">
  <xsl:value-of select="."/>
</xsl:template>
```

Every attribute holding a pattern is checked, such as `xsl:key/@match` and the
`@count` of `xsl:number`. A `//` inside a predicate, as in `item[.//note]`, is
left alone.
