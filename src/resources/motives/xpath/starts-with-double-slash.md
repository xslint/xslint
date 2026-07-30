# Starts with double slash

A leading `//` on a `match` pattern buys nothing and costs something. Every XSLT
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

An inner `//` (`list//item`) is a different defect — vague rather than redundant
— and belongs to `use-double-slash`, while a `//` opening a `@select`, where it
really is a whole-document scan, belongs to `select-starts-with-double-slash`.

Dropping the slashes is offered as a **suggestion**, applied by
`--fix-suggestions` and never by plain `--fix`, for the reason above: the node
set survives the edit, the default priority does not, so a stylesheet whose
templates compete over a node can transform differently afterwards. A pattern of
nothing but the slashes gets no fix at all — emptying it would trade one broken
pattern for another.
