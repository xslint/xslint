# Circular import

A stylesheet that imports or includes itself, directly or through a chain of
modules that pulls it back, is a static error, and the processor refuses to
compile it. Move the shared code into a third module both import.

Incorrect (`a.xsl` and `b.xsl` import each other):

```xsl
<!-- a.xsl -->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="b.xsl"/>
</xsl:stylesheet>

<!-- b.xsl -->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="a.xsl"/>
</xsl:stylesheet>
```

Correct:

```xsl
<!-- a.xsl -->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="common.xsl"/>
</xsl:stylesheet>

<!-- b.xsl -->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="common.xsl"/>
</xsl:stylesheet>
```

A cycle is reported only when every module in it is among the linted files.
