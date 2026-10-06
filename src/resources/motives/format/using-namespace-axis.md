# Using namespace axis

XPath 2.0 deprecated the `namespace::` axis. Outside backwards compatible
mode a processor may refuse it with the static error `XPST0010`, so the same
stylesheet compiles on one processor and fails on the next. Read namespace
bindings with `in-scope-prefixes()` and `namespace-uri-for-prefix()`, which
every 2.0 processor has.

Incorrect:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:template match="*">
    <xsl:for-each select="namespace::*">
      <xsl:value-of select="."/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:template match="*">
    <xsl:variable name="element" select="."/>
    <xsl:for-each select="in-scope-prefixes($element)">
      <xsl:value-of select="namespace-uri-for-prefix(., $element)"/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
```

Only XSLT 2.0 and later stylesheets are checked. A `namespace::` step of a
`match` pattern is left alone, since no function can stand there.
