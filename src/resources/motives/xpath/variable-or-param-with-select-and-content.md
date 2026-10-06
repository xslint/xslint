# Using internal content and @select to set a variable, param or with-param

An `xsl:variable`, `xsl:param` or `xsl:with-param` takes its value from its
`select` or from its body, never both. Given both, XSLT raises a static error
(XTSE0620), and the stylesheet does not run on any version. Keep whichever of
the two says what you meant.

Incorrect:

```xsl
<xsl:variable name="physicist" select="'Isaac Newton'">
    Albert Einstein
</xsl:variable>
```

or:

```xsl
<xsl:call-template name="cite">
  <xsl:with-param name="physicist" select="'J.J. Thomson'">
    Max Planck
  </xsl:with-param>
</xsl:call-template>
```

Correct:

```xsl
<xsl:variable name="physicist">
    Marie Curie
</xsl:variable>
```

or:

```xsl
<xsl:variable name="physicist" select="'Ernest Rutherford'"/>
```

A body of nothing but whitespace and comments is empty, unless an
`xml:space="preserve"` keeps the whitespace.
