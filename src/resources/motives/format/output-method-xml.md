# Output method xml

Serializing an HTML document with `method="xml"` writes XML where a browser
expects HTML: an empty element comes out `<br/>` rather than `<br>`, a script
or style body is escaped, and no `<!DOCTYPE html>` is emitted. Switch to
`method="html"` when the document being built is HTML.

What makes the document HTML is its outermost element, not an `html`
somewhere inside it. An XML document may embed an HTML fragment and stay
XML — an Atom entry's `content`, an XHTML island in a larger vocabulary — and
there `method="xml"` is the right serialization. An `html` in the XHTML
namespace is a third case: XHTML serializes as `xml` in XSLT 1.0 and as
`xhtml` from 2.0, never as `html`.

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
