# Use node-set extension

The `node-set()` extension function converts a result tree fragment into a
node-set, a workaround XSLT 1.0 needed. From 2.0 on a temporary tree is queried
directly, so the call only ties the stylesheet to an extension namespace it no
longer needs. Query the variable itself.

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

Only XSLT 2.0 and later stylesheets are checked, for the function in EXSLT's
`http://exslt.org/common` and Microsoft's `urn:schemas-microsoft-com:xslt`
under any prefix. A `node-set` in a namespace of your own is left alone.
