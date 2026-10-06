# Output method xml

Serializing an HTML document with `method="xml"` writes XML where a browser
expects HTML: an empty element comes out `<br/>` rather than `<br>`, a script
or style body is escaped, and no `<!DOCTYPE html>` is emitted. Switch to
`method="html"` when the document being built is HTML.

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

Only the outermost element the root template builds decides it, so an HTML
fragment inside an XML document, an `html` in the XHTML namespace, and a named
`xsl:output` are left alone.
