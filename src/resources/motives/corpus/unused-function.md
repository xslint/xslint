# Unused function

A stylesheet function that is called from no expression anywhere in the corpus
— neither in its own stylesheet nor in one that imports it — is dead code and
should be removed. A function that *is* called, but only from within a
recursion cycle that nothing enters, is caught by `unreachable-function`
instead.

A function is its namespace, its local name and its arity, as XPath resolves a
call. So `g:format(title)` calls `my:format` wherever both prefixes are bound
to one URI, and so does `Q{urn:my}format(title)`. A declaration of the same
name with two parameters is a different function, left dead by a call passing
one. A call in a text value template, `<p>{my:format(title)}</p>` under an on
`expand-text`, is a call like any other.

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
