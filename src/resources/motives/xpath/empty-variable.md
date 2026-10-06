# Empty `xsl:variable`

An `xsl:variable` with neither a `select` nor content binds the empty string,
and a reader cannot tell a value left out by accident from one meant to be
empty. `select="''"` says which it is. Keep the declaration: code reading the
variable breaks once it is gone.

Incorrect:

```xsl
<xsl:variable name="greeting"/>
```

Correct:

```xsl
<xsl:variable name="greeting" select="''"/>
```

From XSLT 2.0 on, a variable with `as` binds an empty sequence on purpose and
is left alone. In a 1.0 stylesheet `as` does nothing, so it is still reported.
