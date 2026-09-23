# Unused function

A stylesheet function that is called from no expression anywhere in the corpus
— neither in its own stylesheet nor in one that imports it — is dead code and
should be removed. A function that *is* called, but only from functions that
are themselves never reached, is caught by `unreachable-function` instead.

Incorrect:

```xsl
<xsl:function name="my:format">
  <xsl:param name="value"/>
  <xsl:value-of select="$value"/>
</xsl:function>
<!-- my:format is never referenced in match or select -->
```

Correct:

```xsl
<xsl:function name="my:format">
  <xsl:param name="value"/>
  <xsl:value-of select="$value"/>
</xsl:function>

<xsl:template match="/">
  <p><xsl:value-of select="my:format(title)"/></p>
</xsl:template>
```
