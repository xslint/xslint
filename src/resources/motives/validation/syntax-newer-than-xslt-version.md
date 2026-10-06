# XPath syntax newer than the XSLT version in force

A stylesheet's `version` promises which processors can run it. XPath and
patterns grew with XSLT: `cast as` is 2.0, and a `self` axis in a pattern is
3.0. A newer processor runs the file anyway, so the fault surfaces only where a
processor of the declared version refuses to compile it. Raise the `version`, or
spell the construct the way the declared version allows.

Incorrect (a parenthesized pattern step is XSLT 3.0):

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="metas/meta[head = 'also']/(tail|part)">
    <xsl:value-of select="."/>
  </xsl:template>
</xsl:stylesheet>
```

Correct (the same nodes as a union of whole paths):

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="metas/meta[head = 'also']/tail | metas/meta[head = 'also']/part">
    <xsl:value-of select="."/>
  </xsl:template>
</xsl:stylesheet>
```

Correct as well, where nothing holds the stylesheet at 2.0:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0">
  <xsl:template match="metas/meta[head = 'also']/(tail|part)">
    <xsl:value-of select="."/>
  </xsl:template>
</xsl:stylesheet>
```
