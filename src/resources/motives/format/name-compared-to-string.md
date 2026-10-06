# Name compared to a string

`name() = 'xsl:message'` compares the prefix the source happens to use, so it
fails under a different but equivalent namespace binding, and
`local-name() = 'x'` ignores the namespace entirely. Both build a string to ask
what a node test asks directly. Match the element on the self axis:
`self::xsl:message`, or `self::*:x` in XSLT 2.0 and later.

Incorrect:

```xsl
<xsl:if test="name() = 'xsl:message'">
  <xsl:apply-templates select="*[local-name() = 'label']"/>
</xsl:if>
```

Correct:

```xsl
<xsl:if test="self::xsl:message">
  <xsl:apply-templates select="*[self::*:label]"/>
</xsl:if>
```

Only an equality comparison whose context is an element is reported, and a
`local-name()` one only from XSLT 2.0. Under `@*`, a
`processing-instruction()`, or a context nothing pins down, the string
comparison stays.
