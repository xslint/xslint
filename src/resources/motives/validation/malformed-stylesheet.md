# Malformed stylesheet

A stylesheet that is not well-formed XML cannot be parsed, so no processor runs
it and no other check reads it. Besides an unclosed element, the usual causes
are a bare `&` (write `&amp;`, in a URL too), an unquoted attribute value, a
`]]>` outside a CDATA section (write `]]&gt;`), and a prefix such as `xsl` with
no `xmlns:xsl` declaration in scope.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <a href="list?page=2&sort=name">Tom & Jerry</a>
    <code>rows[cells[0]]> 1</code>
    <xsl:value-of select=$total/>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <a href="list?page=2&amp;sort=name">Tom &amp; Jerry</a>
    <code>rows[cells[0]]&gt; 1</code>
    <xsl:value-of select="$total"/>
  </xsl:template>
</xsl:stylesheet>
```

The file is reported once and skipped, so the other stylesheets are still
checked.
