# Starts with double slash

A leading `//` on a pattern selects nothing extra. Every XSLT pattern is matched
unanchored — a node matches when any alternative of the pattern matches it,
wherever it sits — so in a document `match="//item"` and `match="item"` select
the same nodes, every `item` at any depth. Read carelessly, the `//` suggests a
scan of the whole document that never happens.

What it does add, from XSLT 2.0 on, is a condition on the tree. A pattern opening
with `/` or `//` matches only a node whose tree is rooted at a document node,
where `item` matches in a parentless tree too — an element built into a variable
declared `as="element()"`, say:

```xsl
<xsl:variable name="built" as="element()">
  <item/>
</xsl:variable>
<xsl:apply-templates select="$built"/>
```

A template matching `item` handles that element, and one matching `//item` does
not. XSLT 1.0 has no parentless trees, a result tree fragment always having a
root node, so there the two spellings are one. The same holds for an `xsl:key`
at any version, since `key()` answers only over a tree rooted at a document node.
Everywhere else on 2.0+, check that no pattern is applied to a parentless tree,
such as one bound with `as="element()"`, before dropping the `//`, or keep the
tree rooted by building it in an `xsl:document`.

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

An alternative of a union is matched exactly as a whole pattern is — the node
matches when any one of them matches it — so the same `//` is as redundant in
`match="chapter | //item"` as it is alone, and it buys the same half point:
XSLT computes a default priority for each alternative separately, as though the
rule had been written out once per branch. Write each branch the shape you mean:

```xsl
<xsl:template match="chapter | item">CONTENT</xsl:template>
```

Where a rule has to keep the rank it had, say so with an explicit `priority`
rather than leaning on a `//` to buy half a point:

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
template's concern alone, so in the others a leading `//` costs the misreading
and, from 2.0 on, the parentless trees described above: a `count` that skips
the nodes of one, or a group that never starts in one.
