# Function use in a pre-2.0 stylesheet

`xsl:function` arrives in XSLT 2.0, so a function standing where the version in
force is below 2.0 cannot run on the processor that version names. The version
in force is the nearest `version` (or `xsl:version`) declared above it.

Either replace the function with an `xsl:template` that has a `name`, or raise
the stylesheet to `version="2.0"`.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:function name="my:foo">
    <!-- body logic -->
  </xsl:function>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:template name="foo">
    <!-- body logic -->
  </xsl:template>
</xsl:stylesheet>
```

or:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:function name="my:foo">
    <!-- body logic -->
  </xsl:function>
</xsl:stylesheet>
```
