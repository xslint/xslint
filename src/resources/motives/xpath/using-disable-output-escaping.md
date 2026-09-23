# Using disable-output-escaping

Setting `disable-output-escaping="yes"` bypasses XML serialization rules and
produces implementation-defined, non-portable results. Use `xsl:copy-of` or
proper element construction to emit pre-formed markup.

The attribute is XSLT's own, and `xsl:value-of` and `xsl:text` are the only
two instructions that carry it. An element of the result vocabulary spelling
the same name is not using the feature at all: there the attribute is output
data, copied into the result tree like any other, and no processor reads it as
an instruction.

XSLT 3.0 spells the attribute `_disable-output-escaping` as readily as
`disable-output-escaping`, the underscore form holding an attribute value
template a processor evaluates before it transforms anything. So
`_disable-output-escaping="{'yes'}"` is the same instruction written the modern
way, and a processor honours it exactly as it honours the plain spelling.

Incorrect:

```xsl
<xsl:value-of select="raw-html" disable-output-escaping="yes"/>
```

Correct:

```xsl
<xsl:copy-of select="raw-html/node()"/>
```
