# Leaking result namespace

A literal result element copies every namespace in scope into the result, so a
prefix declared only for the stylesheet's logic (`xs` for `as="xs:integer"`, a
prefix for your own functions) is serialized onto output elements that never
use it. List the prefix in `exclude-result-prefixes` on the stylesheet root:
expressions still use it, and the output no longer carries it.

Incorrect:

```xsl
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xsl:template match="/">
    <object>
      <xsl:value-of select="1 cast as xs:integer"/>
    </object>
  </xsl:template>
</xsl:stylesheet>
<!-- <object> is serialized as <object xmlns:xs="..."> -->
```

Correct:

```xsl
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:template match="/">
    <object>
      <xsl:value-of select="1 cast as xs:integer"/>
    </object>
  </xsl:template>
</xsl:stylesheet>
```

A simplified stylesheet, whose root is itself a literal result element, spells
the attribute `xsl:exclude-result-prefixes`.
