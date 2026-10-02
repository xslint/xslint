# Template has no @name or @match

A template with neither `name` nor `match` can be reached by nothing: no
`xsl:apply-templates` selects it, since it matches no node, and no
`xsl:call-template` names it. Its body is dead code, and a processor refuses
the module as a static error (XTSE0500) rather than skipping the template, so
one unreachable rule stops the whole stylesheet from running. Give it the
`match` pattern it should be selected by, or the `name` it should be called
by.

Incorrect:

```xsl
<xsl:template>
  <!--body-->
</xsl:template>
```

Correct:

```xsl
<xsl:template match="o/o">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template name="oo">
  <!--body-->
</xsl:template>
```

or:

```xsl
<xsl:template name="oo" match="o/o">
  <!--body-->
</xsl:template>
```
