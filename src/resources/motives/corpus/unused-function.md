# Unused function

A stylesheet function that no expression in the corpus calls, in its own
stylesheet or in one that imports it, is dead code: it costs the reader time and
drifts out of date unnoticed. Remove it, or call it.

A call matches a function by namespace URI, local name, and arity, so a
declaration with two parameters stays dead under a call passing one. A
function called only from functions never reached is reported by
`unreachable-function` instead.

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
