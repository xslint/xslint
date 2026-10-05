# Unreachable function

A function called only from functions that are never reached can never run,
even though its name appears in a call. The dead caller is often a function
nothing calls (which `unused-function` reports), or a recursion cycle nothing
enters, such as `my:even` and `my:odd` calling only each other. Delete the dead
callers with what they alone call, or call them from a template or a global
variable.

Incorrect:

```xsl
<xsl:function name="my:even" as="xs:boolean">
  <xsl:param name="number" as="xs:integer"/>
  <xsl:sequence select="if ($number = 0) then true() else my:odd($number - 1)"/>
</xsl:function>
<xsl:function name="my:odd" as="xs:boolean">
  <xsl:param name="number" as="xs:integer"/>
  <xsl:sequence select="if ($number = 0) then false() else my:even($number - 1)"/>
</xsl:function>
<!-- neither my:even nor my:odd is ever called from a template -->
```

Correct:

```xsl
<xsl:function name="my:even" as="xs:boolean">
  <xsl:param name="number" as="xs:integer"/>
  <xsl:sequence select="if ($number = 0) then true() else my:odd($number - 1)"/>
</xsl:function>
<xsl:function name="my:odd" as="xs:boolean">
  <xsl:param name="number" as="xs:integer"/>
  <xsl:sequence select="if ($number = 0) then false() else my:even($number - 1)"/>
</xsl:function>

<xsl:template match="/">
  <xsl:value-of select="my:even(count(//node()))"/>
</xsl:template>
```
