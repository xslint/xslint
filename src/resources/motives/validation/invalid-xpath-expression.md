# Invalid XPath expression

A malformed expression stops the transformation when the processor reaches it.
Every place one stands is read: an attribute holding XPath (`select`, `test`,
`use-when` and the like), a pattern (`match`, `count`, `from`), and each `{...}`
of a value template. A pattern is held to the narrower pattern language, which
names no `parent`, `ancestor`, `following` or `preceding` step outside a
predicate. Syntax that a later XSLT version admits is reported by
`syntax-newer-than-xslt-version` instead.

Incorrect (`==` is not an XPath operator):

```xsl
<xsl:if test="foo(a) == 'hello'">
  <xsl:value-of select="."/>
</xsl:if>
```

Correct:

```xsl
<xsl:if test="foo(a) = 'hello'">
  <xsl:value-of select="."/>
</xsl:if>
```

Incorrect (a pattern cannot look sideways):

```xsl
<xsl:template match="following-sibling::para">
  <xsl:value-of select="."/>
</xsl:template>
```

Correct (a predicate may look anywhere):

```xsl
<xsl:template match="para[preceding-sibling::*]">
  <xsl:value-of select="."/>
</xsl:template>
```
