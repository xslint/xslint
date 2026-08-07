# Redundant namespace declarations

A namespace prefix declared on the `xsl:stylesheet` element but never used by
any element name, attribute name, or qualified name inside an attribute value
is dead weight that misleads the reader and should be removed.

Two attributes use a prefix without qualifying anything with it, and a prefix
either of them names is in use:
`exclude-result-prefixes` keeps the namespace out of the result tree, and
`extension-element-prefixes` marks it as holding extension instructions. Both
hold bare prefixes, separated by whitespace, and `exclude-result-prefixes="#all"`
names every prefix in scope at once. Removing a declaration one of them names
leaves the reference bound to nothing, and a conformant processor refuses to
compile the stylesheet.

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

A prefix whose only mention is a prefix list is used, and its declaration stays:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:foo="urn:foo"
  exclude-result-prefixes="foo" version="2.0">
  <!-- foo is declared so that exclude-result-prefixes can name it -->
</xsl:stylesheet>
```
