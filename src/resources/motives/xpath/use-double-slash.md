# Use double slash

A `//` step in a `match` pattern matches the node at *any* depth, so the
pattern is broader and vaguer than a named path. It is not a performance
problem — a match pattern is tested against a node, not walked as a query — but
`root//item` will also match an `item` nested far deeper than you meant as the
document grows, and it hides the structure the template actually expects. When
you know the shape of the input, name the path.

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

A pattern that *opens* with `//`, with or without whitespace before it, is a
different defect — redundant rather than vague — and belongs to
`starts-with-double-slash`, which is where its fix lives too.
