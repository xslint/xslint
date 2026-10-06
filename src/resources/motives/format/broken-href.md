# Broken href

An `xsl:import` or `xsl:include` whose `href` names a missing file stops the
whole stylesheet from compiling (static error XTSE0165). It usually means the
module was renamed or moved. A relative `href` resolves against the directory
of the stylesheet holding it.

Incorrect, where the module has moved to `lib/`:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="common.xsl"/>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="lib/common.xsl"/>
</xsl:stylesheet>
```

Only a relative `href` is checked, and not on an import under an `xml:base` or
a `use-when`, which may move or skip the module.
