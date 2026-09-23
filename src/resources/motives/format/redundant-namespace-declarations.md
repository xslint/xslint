# Redundant namespace declarations

A namespace prefix declared on the `xsl:stylesheet` element but never used by
any element name, attribute name, or qualified name inside an attribute value
or a text value template is dead weight that misleads the reader and should be
removed. A prefix is used where it qualifies a name, so the `i` of
`xmlns:i` is not used by `tei:item`, whose prefix is `tei`.

Four attributes use a prefix without qualifying anything with it, and a prefix
any of them names is in use:
`exclude-result-prefixes` keeps the namespace out of the result tree,
`extension-element-prefixes` marks it as holding extension instructions, and
the `stylesheet-prefix` and `result-prefix` of `xsl:namespace-alias` map one
namespace onto another in the output. Each holds bare prefixes, and removing a
declaration one of them names leaves the reference bound to nothing, which a
conformant processor refuses to compile. `exclude-result-prefixes="#all"`
names no prefix at all: it excludes whatever is declared, so a declaration
nothing else uses is as dead under it as anywhere.

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

A prefix only `xsl:namespace-alias` names is used too:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:axsl="urn:alias"
  version="2.0">
  <xsl:namespace-alias stylesheet-prefix="axsl" result-prefix="xsl"/>
</xsl:stylesheet>
```
