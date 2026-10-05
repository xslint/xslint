# Not using output

Without an `xsl:output`, the result serializes as `xml`, or as `html` when its
root element is `<html>`, and a reader has to infer which from the shape of the
first element. Declare the output in the stylesheet a transformation starts at.

Incorrect:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <html><body><xsl:value-of select="."/></body></html>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html><body><xsl:value-of select="."/></body></html>
  </xsl:template>
</xsl:stylesheet>
```

Only an entry stylesheet is checked: one with a template matching the document
root, the template named `xsl:initial-template`, or a default-mode template
taking the top element. An unnamed `xsl:output` anywhere in its import tree
counts. A library module or an `xsl:package` is left alone.
