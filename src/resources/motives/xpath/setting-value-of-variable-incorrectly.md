# Setting value of variable incorrectly

A variable or parameter whose body is one `xsl:value-of` builds a result tree
fragment to hold a string it has already computed. A `select` binds that string
directly, which is shorter to read and cheaper to run. Keep the expression
yielding one string: a bare `select="heading"` binds the nodes themselves.

Incorrect:

```xsl
<xsl:variable name="title">
  <xsl:value-of select="heading"/>
</xsl:variable>
```

Correct, in XSLT 1.0:

```xsl
<xsl:variable name="title" select="string(heading)"/>
```

Correct, in XSLT 2.0 and later:

```xsl
<xsl:variable name="title" select="string-join(heading, ' ')"/>
```

The check covers `xsl:variable`, `xsl:param`, and `xsl:with-param` carrying no
`select`, where the `xsl:value-of` has no `separator` and no text stands beside
it.
