# Short names

A single-character name tells a reader nothing about what it holds. At the use
site a binding is just `$f`, and nothing there says which element bound it or
what it was for, so every reader of the template has to go and look. The cost
is paid once per reading and never by the author, which is why these names
survive.

A parameter is a binding like any other, and the one most often spelled this
way: the declaration stands at the top of the template and the uses are spread
through the body, which is exactly the distance a name is supposed to close.

Incorrect:

```xsl
<xsl:template name="indent">
  <xsl:param name="d" as="xs:integer"/>
  <xsl:value-of select="string-join((for $i in 1 to $d return '  '), '')"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template name="indent">
  <xsl:param name="depth" as="xs:integer"/>
  <xsl:value-of select="string-join((for $i in 1 to $depth return '  '), '')"/>
</xsl:template>
```

A prefix does not lengthen the name. `eo:k` and `k` read alike wherever they
are used, since the prefix names the namespace the binding lives in and not the
binding, so the local part is what carries the meaning and what has to earn its
place. The same holds whichever element declares it — an `xsl:variable`, an
`xsl:param`, an `xsl:template` or an `xsl:function`.

Incorrect:

```xsl
<xsl:variable name="eo:r" select="'r'"/>
```

Correct:

```xsl
<xsl:variable name="eo:raw-marker" select="'r'"/>
```

An `xsl:with-param` is left alone. It passes a name the declaration already
fixed, so renaming has to happen where the parameter is declared, and reporting
both would report one author's choice twice.
