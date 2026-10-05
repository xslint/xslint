# Modern construct in a 1.0 stylesheet

A stylesheet whose version in force is below 2.0 promises to run on an XSLT 1.0
processor, which rejects the instructions XSLT 2.0 added. Rewrite the construct
with its 1.0 equivalent (a Muenchian key for `xsl:for-each-group`, a named
template for `xsl:sequence`), or raise the version to 2.0.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:template match="/objects">
    <xsl:for-each-group select="*" group-by="@key">
      <xsl:sequence select="current-group()"/>
    </xsl:for-each-group>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/objects">
    <xsl:for-each-group select="*" group-by="@key">
      <xsl:sequence select="current-group()"/>
    </xsl:for-each-group>
  </xsl:template>
</xsl:stylesheet>
```

The check covers `xsl:for-each-group`, `xsl:sequence`, `xsl:analyze-string`,
`xsl:next-match`, `xsl:perform-sort`, `xsl:namespace`, `xsl:character-map`,
`xsl:result-document`, `xsl:import-schema`, and an `as` attribute on any XSLT
element but `xsl:function`.
