# Malformed version in stylesheet

A processor reads `version` as a decimal to decide which language it runs. A
value that is no decimal, such as `2,0`, `2e0`, or an empty string, names no
version, so one processor may reject the stylesheet and another run it under
rules the author never chose. Write a decimal such as `2.0`.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2,0">
  <xsl:template match="/">
    <xsl:value-of select="count(item)"/>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <xsl:value-of select="count(item)"/>
  </xsl:template>
</xsl:stylesheet>
```

Every `version` on an XSLT element and `xsl:version` on a literal result
element is checked, except `version` on `xsl:output`, which names the output
method's version.
