# Unreachable function

A stylesheet function is reachable only if some call to it lives outside every
function body — in a template, a global variable, or another function that is
itself reachable. A function whose every call sits inside functions that are
never reached can never run, even though its name does appear in a call. Most
often the caller is a function nothing calls at all, which `unused-function`
reports, and every helper it alone calls is dead with it. A recursion cycle
nothing enters is the other shape: a function that calls only itself, or a
pair (`my:even`/`my:odd`) that call only each other. Delete the dead callers
with what they alone call, or reach them from a template.

Unlike `unused-function`, which flags a name that appears in no call at all,
this check flags a name that *is* called yet stays unreachable.

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
