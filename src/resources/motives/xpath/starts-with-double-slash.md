# Starts with double slash

A leading `//` on a pattern selects nothing extra. Every XSLT pattern is matched
unanchored — a node matches when any alternative of the pattern matches it,
wherever it sits — so `match="//item"` and `match="item"` select exactly the same
nodes, every `item` at any depth. Read carelessly, the `//` suggests a scan of the
whole document that never happens.

What it does change is which rule wins. A pattern's default priority comes from
its shape: a lone name test scores 0, while a pattern carrying a `/` step scores
0.5. So `//item` outranks `item` by half a point, and two templates that look
interchangeable are not:

```xsl
<xsl:template match="list/item">SPECIFIC</xsl:template>
<xsl:template match="//item">DOUBLESLASH</xsl:template>
```

Both patterns score 0.5, so the later one wins and every `item` inside a `list`
is handled by `DOUBLESLASH`. Remove the `//` and `list/item` keeps 0.5 while the
bare `item` drops to 0, so the same node is handled by `SPECIFIC` instead. The
output changes though neither template was touched.

Write the pattern the shape you mean, and where a rule has to keep the rank it
had, say so with an explicit `priority` rather than leaning on a `//` to buy half
a point:

Incorrect:

```xsl
<xsl:template match="//item">
  <xsl:value-of select="."/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="item" priority="0.5">
  <xsl:value-of select="."/>
</xsl:template>
```

The redundancy is the same in every attribute that holds a pattern rather than an
expression — `xsl:key/@match`, `xsl:accumulator-rule/@match`, the `@count` and
`@from` of `xsl:number`, and the `@group-starting-with` and `@group-ending-with`
of `xsl:for-each-group`. None of those is anchored either. Priority is a
template's concern alone, so in the others a leading `//` costs only the
misreading.
