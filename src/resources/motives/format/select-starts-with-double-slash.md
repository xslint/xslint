# Select starts with double slash

A `select` whose XPath begins with `//` is evaluated as
`/descendant-or-self::node()/…`, so it walks the entire document from the root
every time it runs — and inside a template applied per node, that is once per
node. Unlike a `match` pattern, where a leading `//` is merely redundant, in a
`select` it is a real, repeated, whole-tree scan.

Most of the time the author meant something narrower than the whole document,
and naming it removes the traversal outright:

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

This is a change of meaning and not a respelling of the same expression, which
is why there is no mechanical rewrite of it. `//item` selects every `item` in
the document; `item` selects the children of the node being matched, and
`.//item` its descendants. Those agree only when the current node is the root,
and where they agree `.//item` walks the same tree the `//` did, so it buys
nothing. Read the template that holds the expression and write the path the
author was reaching for.

Where the whole document genuinely is the subject and the lookup is by value,
an `xsl:key` replaces the repeated scan with an index the processor builds
once:

Incorrect:

```xsl
<xsl:template match="ref">
  <xsl:value-of select="//item[@id = current()/@target]/title"/>
</xsl:template>
```

Correct:

```xsl
<xsl:key name="items" match="item" use="@id"/>

<xsl:template match="ref">
  <xsl:value-of select="key('items', @target)/title"/>
</xsl:template>
```

An inner `//` (`items//item`), a `//` inside a string literal, or one reached
through a variable (`$root//item`) is left alone. So is the `select` of a
literal result element, which is output data on its way to the result tree
rather than an expression any processor evaluates.
