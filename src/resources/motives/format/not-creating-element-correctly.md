# Not creating element correctly

`xsl:element` with a static name writes the element a literal result element of
that name writes, and sends its reader looking for a computed name that is not
there. Use a literal result element, and keep `xsl:element` for a name written
as an attribute value template, `{...}`. A literal result element copies the
namespaces in scope into the output, so list in `exclude-result-prefixes` every
prefix the output must not declare.

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

A name whose prefix binds to the XSLT namespace, or an `xsl:element` with a
`namespace` attribute, has no literal form and is left alone.
