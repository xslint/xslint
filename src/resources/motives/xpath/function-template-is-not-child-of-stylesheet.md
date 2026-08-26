# Function or template is not child of stylesheet

An `xsl:function` or `xsl:template` declares a component of the stylesheet, and
a component belongs where the processor looks for one: at the top level, as a
child of `xsl:stylesheet` or `xsl:transform`. One buried inside another
instruction is never reached, because a template body is a sequence
constructor and a declaration is not an instruction it can hold.

XSLT 3.0 gives it one other home. Inside an `xsl:override` under
`xsl:use-package`, a template or function is the component that replaces the
one the used package declares, and that is the only place an overriding
component may stand. Those are left alone.

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
