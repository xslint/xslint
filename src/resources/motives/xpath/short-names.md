# Short names

A single-character name tells a reader nothing about what it holds. At the use
site a binding is just `$f`, and every reader of the template has to go back to
the declaration to learn what it is for.

Incorrect:

```xsl
<xsl:template name="indent">
  <xsl:param name="d" as="xs:integer"/>
  <xsl:value-of select="string-join((for $i in 1 to $d return '  '), '')"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template name="indent">
  <xsl:param name="depth" as="xs:integer"/>
  <xsl:value-of select="string-join((for $i in 1 to $depth return '  '), '')"/>
</xsl:template>
```

The check covers `xsl:variable`, `xsl:param`, `xsl:template`, and
`xsl:function`, and measures the local part, so `eo:k` is as short as `k`. An
`xsl:with-param` is left alone, since its name is fixed where the parameter is
declared.
