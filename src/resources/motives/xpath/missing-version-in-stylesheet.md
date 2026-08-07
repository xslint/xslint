# Missing version in stylesheet

Every stylesheet declares the XSLT version it conforms to, and one that declares
none is invalid — a conformant processor is required to reject it. Which
attribute carries the declaration depends on the root element.

An `xsl:stylesheet` root, or its exact synonym `xsl:transform`, carries a plain
`version`. A *simplified* stylesheet — one whose root is a literal result element
and whose whole transformation is that element's content — carries `xsl:version`
instead, in the XSLT namespace. An unprefixed `version` will not do there,
because on a literal result element it belongs to the result vocabulary and means
whatever that vocabulary says it means; an SVG or XHTML root may well carry its
own. The prefixed attribute is also the only thing that makes such a document a
stylesheet rather than ordinary XML, so leaving it off does not produce a
stylesheet with a missing version — it produces something a processor will not
recognise as a stylesheet at all.

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

Incorrect:

```xsl
<html xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <body><xsl:value-of select="/page/title"/></body>
</html>
```

Correct:

```xsl
<html xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xsl:version="2.0">
    <body><xsl:value-of select="/page/title"/></body>
</html>
```
