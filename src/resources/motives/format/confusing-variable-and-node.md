# Are you confusing a variable and a node?

When a variable and a child element share a name, a bare `title` in the
`select` of `xsl:apply-templates`, `xsl:for-each`, `xsl:value-of`, or
`xsl:copy-of` picks the child, and the variable is silently ignored. Write
`$title` for the variable. Where the variable may hold an atomic value, rename
it or spell the child `child::title` instead.

Incorrect:

```xsl
<xsl:template match="/">
  <xsl:variable name="title" select="book/title"/>
  <xsl:apply-templates select="title"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="/">
  <xsl:variable name="title" select="book/title"/>
  <xsl:apply-templates select="$title"/>
</xsl:template>
```

Only a name opening a path is checked, against a variable in scope that binds
its value with `select`.
