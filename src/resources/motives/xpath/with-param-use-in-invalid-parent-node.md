# Using `xsl:with-param` in invalid parent node

`xsl:with-param` passes a value to the template a call invokes, so it belongs
only inside `xsl:call-template`, `xsl:apply-templates`, `xsl:apply-imports`,
`xsl:next-match`, `xsl:next-iteration`, or `xsl:evaluate`. Anywhere else a processor refuses
the whole module, and the stylesheet runs no transformation at all.

Incorrect:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:with-param name="Kipling" select="1865"/>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:call-template name="myTemplate">
  <xsl:with-param name="Shakespeare" select="1564"/>
</xsl:call-template>
```

XSLT 1.0 defines `xsl:apply-imports` as empty, so a parameter inside one is
reported where the version in force is below 2.0. Raise that version, or pass
the value another way.
