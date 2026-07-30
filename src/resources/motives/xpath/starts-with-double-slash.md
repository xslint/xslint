# Starts with double slash

A leading `//` on a pattern buys nothing and costs something. Every XSLT
pattern is matched unanchored — a node matches when the pattern selects it from
some ancestor-or-self of it — so `match="//item"` already selects exactly what
`match="item"` selects: every `item`, at any depth. What the `//` does change is
the pattern's *default priority*. A pattern built from a single name test has
priority 0; put a `/` step in front of it and the whole pattern jumps to 0.5. So
`match="//item"` quietly outranks a plain `match="item"` and ties with a
considered `match="list/item"` — and a tie is an error the processor may either
signal or resolve by taking whichever rule was declared last. Sooner or later a
rule you meant to be specific loses to one you meant as a catch-all.

Incorrect:

```xsl
<xsl:template match="//item">
  <xsl:value-of select="."/>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="item">
  <xsl:value-of select="."/>
</xsl:template>
```

The check reads every attribute that holds a pattern, not only a template's:
`xsl:key/@match`, `xsl:accumulator-rule/@match`, `xsl:number/@count` and
`@from`, and `@group-starting-with`/`@group-ending-with` on
`xsl:for-each-group`. Whitespace in front of the slashes does not hide them. An
inner `//` (`list//item`) belongs to `use-double-slash`, and a `//` opening a
`@select` — where it really is a whole-document scan — to
`select-starts-with-double-slash`.

Dropping the slashes is offered as a **suggestion**, applied by
`--fix-suggestions` and never by plain `--fix`, for the reason above: the node
set survives the edit, the default priority does not, so a stylesheet whose
templates compete over a node can transform differently afterwards. On a key, an
accumulator rule, or a numbering or grouping pattern no priority is at stake and
the edit is purely cosmetic, but the check offers one tier rather than two.
