# Stylesheet has no templates

A stylesheet or package that declares nothing at all contributes nothing to a
transformation: it produces no output and exports nothing to an importer.
Usually it is a file somebody started and never wrote. Fill it, or, if it is a
customisation hook another stylesheet imports, say so in a comment.

Any top-level XSLT element counts as a declaration, so a module holding only
an `xsl:output`, an `xsl:import`, or a key is left alone.

Incorrect:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>
```

Correct:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:template match="/">
    <p><xsl:value-of select="."/></p>
  </xsl:template>
</xsl:stylesheet>
```
