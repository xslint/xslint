# Function or template is not child of stylesheet

An `xsl:function` or `xsl:template` declares a component, and a processor looks
for components only at the top level, as children of `xsl:stylesheet`,
`xsl:transform` or `xsl:package`. One nested inside another instruction is an
error, and the stylesheet does not compile.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="chapter">
    <xsl:function name="my:depth" as="xs:integer">
      <xsl:sequence select="1"/>
    </xsl:function>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="chapter">
    <xsl:value-of select="my:depth(.)"/>
  </xsl:template>
  <xsl:function name="my:depth" as="xs:integer">
    <xsl:sequence select="1"/>
  </xsl:function>
</xsl:stylesheet>
```

A template or function inside `xsl:override` replaces a component of a used
package, and is left alone.
