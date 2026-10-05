# Redundant double negation

`not(not(x))` negates `x` twice, which only coerces it to a boolean. A reader
has to cancel the two `not`s in their head and then wonder whether the author
meant something subtler. Write `boolean(x)`, or plain `x` where only a truth is
taken: a `test`, a `use-when`, an operand of `and` or `or`, or a condition.

Incorrect:

```xsl
<xsl:if test="not(not(@enabled))">
<xsl:value-of select="@a and not(not(@enabled))"/>
<xsl:value-of select="not(not(@enabled))"/>
```

Correct:

```xsl
<xsl:if test="@enabled">
<xsl:value-of select="@a and @enabled"/>
<xsl:value-of select="boolean(@enabled)"/>
```
