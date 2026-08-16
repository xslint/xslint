# Use double slash

A `//` step in a pattern matches the node at *any* depth, so the pattern is
broader and vaguer than a named path. It is not a performance problem — a
pattern is tested against a node, not walked as a query — but `root//item` will
also match an `item` nested far deeper than you meant as the document grows, and
it hides the structure the template actually expects. When you know the shape of
the input, name the path.

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

Every attribute holding a pattern reads the same way — `xsl:key/@match`,
`xsl:accumulator-rule/@match`, the `@count` and `@from` of `xsl:number`, and the
`@group-starting-with` and `@group-ending-with` of `xsl:for-each-group`. A `//`
widens what one of those takes in exactly as it widens a template's `@match`:

```xsl
<xsl:key name="lookup" match="chapter/section/item" use="@id"/>
```

Characters that merely look like a step are none: the `//` of a URL inside a
string literal, of a comment, or of the namespace an inline `Q{...}` spells is
part of the thing it stands in and reaches no depth at all, so
`match="a[@href = 'http://example.com']"` names one child element and nothing
deeper.
