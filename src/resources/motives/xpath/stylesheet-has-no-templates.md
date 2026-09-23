# Stylesheet has no templates

A stylesheet or package that declares nothing at all contributes nothing to a
transformation: it produces no output, exports nothing to an importer, and
settles no serialization. Usually it is a file somebody started and never
wrote.

What counts as declaring something is anything XSLT lets stand at the top
level, and not templates alone. A module holding only an `xsl:output` sets
the serialization for every stylesheet that imports it; one holding only
`xsl:import` aggregates a pipeline; one holding only keys, attribute sets or
parameters is a library its importers draw on; and under `xsl:use-package` the
components sit inside `xsl:override` rather than beside it. Each of those is a
module doing exactly what a module is for, and each is left alone.

An empty module is not always dead, though. A distribution often ships one on
purpose as a customisation hook, imported or included by its main stylesheet
so that a user can drop their own templates into it. Deleting such a module
breaks the stylesheet that imports it, since an `xsl:import` or `xsl:include`
naming a missing file is a static error; fill it, or keep it and say in a
comment what it is for.

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
