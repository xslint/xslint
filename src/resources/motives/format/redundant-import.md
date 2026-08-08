# Redundant import

Referencing the same module twice the same way in one stylesheet adds nothing —
both references bring in the same templates, functions, and variables. At best
it is noise; at worst it hides which reference a reader should reason about.
Keep a single reference per module.

A repeated `xsl:import` is not simply noise, though, and removing one is not
simply tidying. Import precedence is positional — XSLT 1.0 §2.6.2 ranks each
`xsl:import` above everything declared before it — so importing one module
twice puts that module at two precedence levels at once, and both of them are
live. Two things follow, and they pull in opposite directions.

The later reference is the one that decides which module wins. With another
module imported in between, the two references sit on opposite sides of it, so
`alpha` below overrides `beta`, and it would not if the third line were the one
removed:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="alpha.xsl"/>
  <xsl:import href="beta.xsl"/>
  <xsl:import href="alpha.xsl"/>
</xsl:stylesheet>
```

The earlier reference is not idle either, because `xsl:apply-imports` walks
*down* the precedence chain and meets the module at every level it occupies.
Where `alpha.xsl` ends its rule in an `xsl:apply-imports`, that stylesheet emits
`ABA` — `alpha` at the top level, then `beta`, then `alpha` again at the bottom
one. Import it twice with nothing in between and the output is `AA` where a
single import gives `A`. XSLT 2.0's `xsl:next-match` walks the same chain.

So a duplicate `xsl:import` is a decision to make by hand, with the whole
stylesheet's overriding in view. Where the module's rules do not reach back
down the chain, one reference is enough:

Incorrect:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="alpha.xsl"/>
  <xsl:import href="beta.xsl"/>
  <xsl:import href="alpha.xsl"/>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:import href="beta.xsl"/>
  <xsl:import href="alpha.xsl"/>
</xsl:stylesheet>
```

A repeated `xsl:include` carries none of this. An include has no precedence
level of its own — the module's definitions land at the level of the stylesheet
including it — so the chain `xsl:apply-imports` walks is the same whether the
module is included once or twice, and the repeat really is only noise.

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
