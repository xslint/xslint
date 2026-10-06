# Redundant boolean call

Wherever only a truth is taken, XPath already computes the effective boolean
value, so `boolean(x)` behaves exactly as `x` and the reader has to look past
the call to find the condition. Drop the wrapper in a `@test` or `use-when`, an
operand of `and` or `or`, the argument of `not()`, an `if` condition, or a
`satisfies` body.

Where the value is used, as in a comparison, a predicate, or an attribute
value template, the call changes the result and is left alone.

Incorrect:

```xsl
<xsl:if test="boolean(@enabled)">
<xsl:value-of select="not(boolean(@enabled))"/>
<xsl:value-of select="boolean(@enabled) and normalize-space(title)"/>
```

Correct:

```xsl
<xsl:if test="@enabled">
<xsl:value-of select="not(@enabled)"/>
<xsl:value-of select="@enabled and normalize-space(title)"/>
```
