# Stylesheet has no templates

A stylesheet that declares nothing at all contributes nothing to a
transformation: it produces no output, exports nothing to an importer, and
settles no serialization. It is a file somebody started and never wrote.

What counts as declaring something is anything XSLT lets stand at the top
level, and not templates alone. A module holding only an `xsl:output` sets
the serialization for every stylesheet that imports it; one holding only
`xsl:import` aggregates a pipeline; one holding only keys, attribute sets or
parameters is a library its importers draw on; and under `xsl:use-package` the
components sit inside `xsl:override` rather than beside it. Each of those is a
module doing exactly what a module is for, and each is left alone.

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
