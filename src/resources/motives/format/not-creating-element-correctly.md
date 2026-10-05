# Not creating element correctly

`xsl:element` with a static name promises a computed one and delivers none. Use
a literal result element, and keep `xsl:element` for a name written as an
attribute value template, `{...}`, the only spelling XSLT evaluates there. A `$`
or a bracket outside those braces is part of the name itself.

A literal result element also copies the namespaces in scope on it into the
output, where `xsl:element` copies none, so list in `exclude-result-prefixes`
every prefix the output must not declare.

Two static names still want the instruction. A name whose prefix binds to the
XSLT namespace has no literal form at all: `<xsl:element name="xsl:template"/>`
writes an element into the result tree, where `<xsl:template>` is an
instruction the processor runs. And a `namespace` attribute puts the element in
a namespace named outright, which a literal result element cannot do — it takes
its own from the prefixes in scope.

Incorrect:

```xsl
<xsl:element name="div">
  <xsl:value-of select="."/>
</xsl:element>
```

Correct:

```xsl
<div>
  <xsl:value-of select="."/>
</div>
```
