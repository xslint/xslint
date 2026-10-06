# Unused function or template parameter

A parameter the body never references is dead code. Every `xsl:with-param`
supplying it is dead too, and on an `xsl:function` every call still passes a
value the body ignores. Delete the parameter and the arguments that supply it,
or, if it was meant to be read, look for a misspelled reference.

Incorrect:

```xsl
<xsl:template name="greet">
  <xsl:param name="name"/>
  <p>Hello</p>
</xsl:template>
```

Correct:

```xsl
<xsl:template name="greet">
  <xsl:param name="name"/>
  <p><xsl:value-of select="concat('Hello, ', $name)"/></p>
</xsl:template>
```

Only a reference in an XPath expression or a value template counts; the name in
result text, a string literal, or a comment does not. A `required="yes"`
parameter is left alone.
