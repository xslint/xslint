# Scans whole document

A path opening with `//` is evaluated as `/descendant-or-self::node()/…`, so it
walks the entire document from the root — and it does so every time the
expression it stands in is evaluated. Inside a template applied per node, that
is once per node; inside the `use` of an `xsl:key`, once per node the key
matches; inside an attribute value template, once per element instantiated.
Unlike a `match` pattern, where a leading `//` is merely redundant, here it is
a real, repeated, whole-tree scan.

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

Where the whole document is the subject and the answer does not depend on the
node being processed, a top-level binding pays for the walk once:

Incorrect:

```xsl
<xsl:template match="ref">
  <xsl:value-of select="count(//item)"/>
</xsl:template>
```

Correct:

```xsl
<xsl:variable name="items" select="//item"/>

<xsl:template match="ref">
  <xsl:value-of select="count($items)"/>
</xsl:template>
```

That is why a `//` inside a top-level `xsl:variable` or `xsl:param` is left
alone: it is bound once for the transformation, against the source root, and
there is no cheaper way to name every `item` in a document.

Where the slashes stand inside the expression does not matter, only whether
they open a path. `distinct-values((//a, //b))` walks the tree twice for the
same reason `//a` walks it once. An inner `//` (`items//item`), one inside a
string literal, and one reached through a variable (`$root//item`) or the
context node (`.//item`) are left alone — none of them starts at the root.
