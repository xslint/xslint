# Missing version in stylesheet

Every stylesheet declares the XSLT version it conforms to, and one that declares
none is invalid — a conformant processor is required to reject it. Which
attribute carries the declaration depends on the root element.

A root XSLT defines itself carries a plain `version`: `xsl:stylesheet`, its exact
synonym `xsl:transform`, and — since XSLT 3.0 — `xsl:package`, which declares a
module other stylesheets can use. A *simplified* stylesheet — one whose root is a
literal result element and whose whole transformation is that element's
content — carries `xsl:version` instead, in the XSLT namespace. An unprefixed
`version` will not do there,
because on a literal result element it belongs to the result vocabulary and means
whatever that vocabulary says it means; an SVG or XHTML root may well carry its
own. The prefixed attribute is also the only thing that makes such a document a
stylesheet rather than ordinary XML, so leaving it off does not produce a
stylesheet with a missing version — it produces something a processor will not
recognise as a stylesheet at all.

A third arrangement carries nothing on its root at all. An *embedded* stylesheet
is a document of data with an `xsl:stylesheet` inside it, picked out by an
`xml-stylesheet` instruction pointing at that element's `id`. The version belongs
to the embedded element, which declares it as any other stylesheet root does, and
the outer root is data — adding `xsl:version` to it would claim the whole
document is a transformation, which is the one thing it is not.

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
