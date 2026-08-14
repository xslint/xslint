# Use node-set extension

The `node-set()` extension function is an XSLT 1.0 workaround for converting
result tree fragments into node-sets. It is unnecessary in XSLT 2.0 and later,
where temporary trees can be queried directly.

Two namespaces declare it for that one purpose — EXSLT's common module,
`http://exslt.org/common`, and Microsoft's `urn:schemas-microsoft-com:xslt` —
and the prefix a stylesheet binds to either is the author's to choose, so
`exsl:node-set`, `msxsl:node-set` and `common:node-set` can all be the same
call. A `node-set` of your own, in a namespace of your own, is a different
function and does whatever you wrote it to do.

Incorrect:

```xsl
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:exsl="http://exslt.org/common">
  <xsl:output method="html"/>
  <xsl:template match="/">
    <xsl:variable name="nodes"><item>A</item></xsl:variable>
    <xsl:for-each select="exsl:node-set($nodes)/item">
      <p><xsl:value-of select="."/></p>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:template match="/">
    <xsl:variable name="nodes"><item>A</item></xsl:variable>
    <xsl:for-each select="$nodes/item">
      <p><xsl:value-of select="."/></p>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
```
