# Redundant namespace declarations

A namespace prefix declared on the `xsl:stylesheet` and never used sends its
reader looking for names it qualifies. Remove the declaration.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:foo="urn:foo" version="2.0">
  <!-- the foo prefix is never used anywhere -->
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <!-- only namespaces that are actually used are declared -->
</xsl:stylesheet>
```

A prefix is used where it qualifies a name in an element, an attribute, an
expression or a value template, or where a prefix list or `xsl:namespace-alias`
names it. A computed `xsl:element` or `xsl:attribute` name, or an
`xsl:evaluate`, may resolve any prefix. Where a literal result element copies
the namespace out and no `#all` of XSLT 2.0 or later excludes it, removing the
declaration changes the output.
