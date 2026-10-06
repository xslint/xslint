# Not creating attribute correctly

An `xsl:attribute` with a static name and a simple value writes what a literal
attribute writes, and sends its reader looking for a computation that is not
there. On a literal result element, when its value is plain text, empty, or a
single `xsl:value-of` or `xsl:text`, write it in the start tag, with an
attribute value template for a computed value and `{{` for a literal brace.

Incorrect:

```xsl
<td>
  <xsl:attribute name="class"><xsl:value-of select="@c"/></xsl:attribute>
  <xsl:attribute name="role">cell</xsl:attribute>
</td>
```

Correct:

```xsl
<td class="{@c}" role="cell"/>
```

It is left alone when it carries `namespace`, `separator`, `type` or
`validation`, reads a variable declared beside it, or follows an instruction
that could write an attribute itself.
