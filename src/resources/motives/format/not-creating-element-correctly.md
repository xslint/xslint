# Not creating element correctly

`xsl:element` with a static, literal name builds exactly the element a literal
result element writes, so a stylesheet mixing the two sends its reader looking
for the computation every `xsl:element` promises, and finds none. One way to
say one thing keeps the literal result element for a fixed name and
`xsl:element` for a name the stylesheet computes — one written as an attribute value template, `{...}`,
which is the only spelling XSLT evaluates there. A `$` or a bracket standing
outside those braces is part of the name itself, not a computation.

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
