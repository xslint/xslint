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

A prefix is used where it qualifies an element name, an attribute name, or a
name inside an expression or value template (a mention in an XPath comment
qualifies nothing), and where `exclude-result-prefixes`,
`extension-element-prefixes` or `xsl:namespace-alias` names it. A literal
result element copies every namespace in scope into the output unless `#all`
excludes it, so a declaration in its scope is used too, and removing it
changes what the stylesheet writes.
