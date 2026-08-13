# Incorrect use of boolean constants

When an `xsl:if` or `xsl:when` test is the bare string `'true'` or `'false'`,
it is a non-empty string, so the branch is *always* taken — `test="'false'"`
runs when you meant it never should. Say what you mean with the boolean
functions `true()` and `false()`.

Incorrect (the branch always runs):

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

The quote makes no difference: `'true'` and `"true"` are the same string, and an
attribute already standing in double quotes writes the constant
`test="&quot;true&quot;"`, which is always true exactly as the single-quoted
spelling is.

Comparing a value to the string `'true'` is a different thing and correct —
XML attributes are strings, so `@active = 'true'` is how you test one. That,
and literal output like `<td hidden="true"/>`, are left alone.
