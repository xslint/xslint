# Output method xml

Using `method="xml"` while the root template generates `html` or `HTML`
elements causes incorrect serialization. Switch to `method="html"` when
producing HTML output.

Incorrect:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml"/>
  <xsl:template match="/">
    <html><body><xsl:value-of select="."/></body></html>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:template match="/">
    <html><body><xsl:value-of select="."/></body></html>
  </xsl:template>
</xsl:stylesheet>
```
