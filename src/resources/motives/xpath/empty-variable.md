# Empty `xsl:variable`

An `xsl:variable` gets its value either from a `@select` attribute or from the
sequence constructor inside it. With neither, the variable binds to an empty
string, and a reader cannot tell a value left out by accident from one meant
to be empty. `select="''"` says which it is.

Keep the declaration itself. An empty top-level variable is often a
placeholder other code reads, or that an importing stylesheet overrides, and
every `$name` referring to it is a static error once it is gone.

A variable that declares a type with `@as` is a different case and is not
flagged **from XSLT 2.0 on**: `<xsl:variable name="acc" as="node()*"/>` binds
the empty *sequence* of that type on purpose — a deliberate empty accumulator,
not an accidental empty string. The exclusion is version-scoped: in XSLT 1.0
`@as` is not a recognized attribute, so it is inert and the variable still binds
the empty string. A `1.0` stylesheet with an empty `@as` variable is therefore
still flagged — the `@as` does not do what its author expects.

Incorrect:

```xsl
<xsl:variable name="greeting"/>
```

Correct:

```xsl
<xsl:variable name="greeting" select="''"/>
```

or, where a value was meant:

```xsl
<xsl:variable name="greeting" select="'hello'"/>
```

or:

```xsl
<xsl:variable name="greeting">hello</xsl:variable>
```

Also correct — a typed empty sequence in XSLT 2.0 or 3.0:

```xsl
<xsl:variable name="acc" as="node()*"/>
```
