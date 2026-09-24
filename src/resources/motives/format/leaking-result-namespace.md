# Leaking result namespace

A literal result element copies every namespace in scope on the stylesheet into
the result tree, unless the prefix is excluded. So a prefix declared only for
the stylesheet's own logic — `xs` for a sequence type in `as="xs:integer"`, a
helper `my`/`eo` called from a `select` — is serialized onto output elements it
never names. `xsl:element` does not do this, so the leak appears precisely when
a static `xsl:element` is rewritten as a literal result element. Top-level data
is not one either: an element outside the XSLT namespace standing directly in
the stylesheet, such as a `doc:doc` documentation block, is never instantiated,
so a stylesheet holding nothing else emits no namespace at all — and a prefix
that only such a block names still leaks onto every result element a template
builds.

List such a prefix in `exclude-result-prefixes` on the stylesheet root: the
prefix stays available to expressions and to name declarations, but is dropped
from the serialized output. This differs from a redundant declaration (a prefix
used nowhere, which should be removed): the prefix here is used, just not by any
result element.

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
