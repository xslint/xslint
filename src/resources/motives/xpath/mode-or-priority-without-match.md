# Use @mode or @priority in Template without @match

A template carrying a `name` and no `match` is invoked by name, so `mode` and
`priority` have nothing to decide: both of them only ever choose between the
templates a `match` pattern made candidates for a node. A processor does not
ignore them either — it refuses the module as a static error (XTSE0500), so
the stylesheet does not run at all. Either give the template the `match` the
two attributes are about, or drop them and call it by name.

Incorrect:

```xsl
<xsl:template name="oo" priority="2" mode="qq">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template name="oo" mode="qq">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template name="oo" priority="2">
  <!--body-->
</xsl:template>
```

Correct:

```xsl
<xsl:template name="oo" match="oo" mode="qq">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template name="oo" match="oo" priority="2">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template name="oo" match="oo" priority="2" mode="qq">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template match="oo" priority="2" mode="qq">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template match="oo" priority="2">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template match="oo" mode="qq">
  <!--body-->
</xsl:template>
```
