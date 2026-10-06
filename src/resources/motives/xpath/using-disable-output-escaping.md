# Using disable-output-escaping

Setting `disable-output-escaping="yes"` bypasses XML serialization rules and
produces implementation-defined, non-portable results. Use `xsl:copy-of` or
proper element construction to emit pre-formed markup.

Incorrect:

```xsl
<xsl:value-of select="raw-html" disable-output-escaping="yes"/>
```

Correct:

```xsl
<xsl:copy-of select="raw-html/node()"/>
```

Only `xsl:value-of` and `xsl:text` are checked, with the attribute spelled
plain or as `_disable-output-escaping`.
