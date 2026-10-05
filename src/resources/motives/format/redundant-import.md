# Redundant import

Referencing one module twice in a stylesheet puts it at two precedence levels,
so a reader cannot tell which copy of a template wins or what
`xsl:apply-imports` reaches next. Importing and also including it is worse:
the included copy shadows the imported one, and the stylesheet's own templates
now collide with it at equal precedence. Keep one reference, chosen with the
stylesheet's overriding in view.

Incorrect:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="common.xsl"/>
  <xsl:include href="common.xsl"/>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:include href="common.xsl"/>
</xsl:stylesheet>
```

Two hrefs that resolve to the same file, such as `lib/util.xsl` and
`./lib/util.xsl`, count as one module.
