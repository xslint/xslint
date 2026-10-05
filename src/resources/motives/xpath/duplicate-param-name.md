# Duplicate `xsl:param` name

Two parameters of one template, function, or stylesheet that share a name are a
static error: the processor cannot tell which one a reference binds and rejects
the stylesheet. Names compare as expanded QNames, so `p:size` and `q:size` clash
when both prefixes bind the same namespace. Give the parameters different local
names.

Incorrect:

```xsl
<xsl:template name="render" xmlns:p="urn:a" xmlns:q="urn:a">
  <xsl:param name="p:size"/>
  <xsl:param name="q:size"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template name="render">
  <xsl:param name="width"/>
  <xsl:param name="height"/>
</xsl:template>
```

A pair where either declaration carries a `use-when` is not reported, since
only the processor knows whether both are compiled.
