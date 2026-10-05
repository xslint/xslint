# Incorrect use of boolean constants

When an `xsl:if` or `xsl:when` test is the bare string `'true'` or `'false'`,
it is a non-empty string, so the branch is *always* taken: `test="'false'"`
runs when you meant it never should. Say what you mean with the boolean
functions `true()` and `false()`.

Incorrect:

```xsl
<xsl:if test="'false'">
  <xsl:value-of select="."/>
</xsl:if>
```

Correct:

```xsl
<xsl:if test="false()">
  <xsl:value-of select="."/>
</xsl:if>
```

Either quote is flagged. A comparison such as `@active = 'true'` is left alone,
since attribute values are strings.
