# Empty content in instructions

An `xsl:for-each` or `xsl:if` with no content produces no output, so it is
almost certainly a body deleted or never written. Fill it in or remove the
element.

Incorrect:

```xsl
<xsl:for-each select="item">
</xsl:for-each>
```

Correct:

```xsl
<xsl:for-each select="item">
  <xsl:value-of select="."/>
</xsl:for-each>
```

Whitespace and comments count as empty, since a processor ignores them. Under
`xml:space="preserve"` the whitespace is output, and the instruction is left
alone.
