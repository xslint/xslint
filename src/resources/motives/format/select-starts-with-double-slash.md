# Select starts with double slash

A `select` whose XPath begins with `//` is evaluated as
`/descendant-or-self::node()/…`, so it walks the entire document from the root
every time it runs — and inside a template applied per node, that is once per
node. It is also often a latent bug: the author usually meant "descendants of
the current node" (`.//x`) or a specific path, not "every `x` in the whole
document".

Unlike a `match` pattern, where a leading `//` is merely redundant, in a
`select` it is a real, repeated, whole-tree scan.

Incorrect:

```xsl
<xsl:for-each select="//item">
  <xsl:value-of select="."/>
</xsl:for-each>
```

Correct:

```xsl
<xsl:for-each select=".//item">
  <xsl:value-of select="."/>
</xsl:for-each>
```

An inner `//` (`items//item`), a `//` inside a string literal, or one reached
through a variable (`$root//item`) is left alone. So is the `select` of a
literal result element, which is output data on its way to the result tree
rather than an expression any processor evaluates.
