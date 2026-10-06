# Undefined variable

A reference no binding in scope declares is static error `XPST0008`, and the
processor refuses the whole stylesheet. A local `xsl:variable` or `xsl:param`
reaches only the siblings after it and what they hold, so one declared inside
an `xsl:if` is gone at its closing tag. Correct the name, move the declaration
up, or make the value an `xsl:param`.

Incorrect:

```xsl
<xsl:template match="/">
  <xsl:param name="title"/>
  <xsl:if test="$title">
    <xsl:variable name="heading" select="upper-case($title)"/>
  </xsl:if>
  <h1>
    <xsl:value-of select="$heading"/>
  </h1>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="/">
  <xsl:param name="title"/>
  <xsl:variable name="heading" select="upper-case($title)"/>
  <xsl:if test="$title">
    <h1>
      <xsl:value-of select="$heading"/>
    </h1>
  </xsl:if>
</xsl:template>
```

In a module that may take globals from outside the linted files (a library no
entry stylesheet holds, or one using a package or an unlinted module), a name
no local binding declares is left alone.
