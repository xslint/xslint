# Missing version in stylesheet

A stylesheet that declares no XSLT version is invalid, and a conformant
processor rejects it. Declare `version` on the `xsl:stylesheet`,
`xsl:transform`, or `xsl:package` root.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <!-- stylesheet logic -->
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
    <!-- stylesheet logic -->
</xsl:stylesheet>
```

A simplified stylesheet, whose root is a literal result element, declares
`xsl:version` on that root instead. A stylesheet embedded in a data document
declares `version` on its own `xsl:stylesheet` element.
