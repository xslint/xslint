# A template that writes nothing

A template whose only children are `xsl:variable` declarations computes values
and throws them away. A variable is bound inside the template that declares it
and nothing carries it out, so applying the template contributes nothing to the
result tree: the work runs and the output is empty. On the template matching
the root that means the stylesheet produces nothing at all; on any other it
means a branch of the transformation is dead, and dead in a way no processor
reports, since an empty result is a legal result.

It is almost always a half-finished edit. The variables are the setup for
output that was removed, or that was never written, and the name of the missing
instruction is usually the name of the variable standing there.

A template that deliberately produces nothing is written empty — the "override
to delete" idiom, `<xsl:template match="index"/>`, which suppresses the
built-in rule for those nodes and is left alone here. So is a body holding only
`xsl:param`: a parameter is a signature, and a template may keep the one it
overrides while producing nothing on purpose.

Incorrect:

```xsl
<xsl:template match="section">
  <xsl:variable name="heading" select="title"/>
  <xsl:variable name="count" select="count(item)"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="section">
  <xsl:variable name="heading" select="title"/>
  <xsl:variable name="count" select="count(item)"/>
  <h1><xsl:value-of select="$heading"/></h1>
  <p>Items: <xsl:value-of select="$count"/></p>
</xsl:template>
```
