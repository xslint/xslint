# Starts with double slash

A pattern is matched wherever a node sits, so `match="//item"` selects the same
nodes as `match="item"` and only suggests a document scan that never happens.
The `//` still changes which template wins: a pattern with a `/` step has a
default priority of 0.5, a bare name 0. Drop the `//`, and give the template an
explicit `priority` where it must keep its rank.

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

From XSLT 2.0 on, `//item` also refuses an element in a tree with no document
node, such as a variable declared `as="element()"`.
