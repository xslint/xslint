# Using disable-output-escaping

Setting `disable-output-escaping="yes"` bypasses XML serialization rules and
produces implementation-defined, non-portable results. Use `xsl:copy-of` or
proper element construction to emit pre-formed markup.

The attribute is XSLT's own, and `xsl:value-of` and `xsl:text` are the only
two instructions that carry it. An element of the result vocabulary spelling
the same name is not using the feature at all: there the attribute is output
data, copied into the result tree like any other, and no processor reads it as
an instruction.

Incorrect:

```xsl
<xsl:value-of select="raw-html" disable-output-escaping="yes"/>
```

Correct:

```xsl
<xsl:copy-of select="raw-html/node()"/>
```
