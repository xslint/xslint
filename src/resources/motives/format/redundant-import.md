# Redundant import

Referencing the same module twice the same way in one stylesheet adds nothing —
the second `xsl:import`, or the second `xsl:include`, brings in the same
templates, functions, and variables the first already did. At best it is noise;
at worst it muddies import precedence and hides which reference a reader should
reason about. Keep a single reference per module.

The linter resolves each `@href` against the importing file's own directory, so
two spellings that point at the same file (`lib/util.xsl` and `./lib/util.xsl`)
count as one, and a module imported once directly and once from a sibling is
not confused with a genuine duplicate — only repeats within a single
stylesheet's own list are flagged. A self-import or a cross-file cycle is a
different fault, reported by `circular-import`. A reference carrying no `@href`
names no module at all, and is invalid XSLT rather than a duplicate.

Incorrect:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="common.xsl"/>
  <xsl:import href="common.xsl"/>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="common.xsl"/>
</xsl:stylesheet>
```

Reaching one module both ways is worse than noise, because the two mechanisms
do not agree on precedence. `xsl:include` places the module's definitions at
the precedence of the including stylesheet's own, while `xsl:import` places
them below it. So importing and also including one module gives every
definition in it two lives at two levels: the imported copy is shadowed by the
included one, and a template the stylesheet defines for itself now collides
with the included copy at equal precedence instead of quietly overriding the
imported one.

Which reference to drop is therefore a decision about precedence, not a tidying
up. Keep the `xsl:include` to let the module's definitions rank alongside the
stylesheet's own, or keep the `xsl:import` to let the stylesheet's own override
them — then delete the other.

Incorrect:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="common.xsl"/>
  <xsl:include href="common.xsl"/>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:include href="common.xsl"/>
</xsl:stylesheet>
```
