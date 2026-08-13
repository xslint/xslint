# Redundant double negation

`not(not(x))` negates `x` and then negates the result — a round trip that just
coerces `x` to a boolean. It is exactly `boolean(x)`, and wherever nothing but a
truth is taken it is exactly `x`. Written as a double negation it reads as a
puzzle: the reader has to cancel the two `not`s in their head to see what it
means, and then wonder whether the author meant something subtler than what the
cancellation leaves.

Those places are the `@test` of an `xsl:if` or an `xsl:when`, the `use-when` that
decides whether an element is compiled at all, an operand of `and` or `or`, the
argument of another `not()`, the condition of an `if` expression and the body of
a `satisfies`: each takes the effective boolean value of what stands
there, so the two calls compute what the place computes next anyway. Everywhere
else the boolean value is the value of the expression, and `boolean(x)` says it
once instead of twice. An argument that binds loosely needs brackets when it
stands as an operand, since `a or b` written where `not(not(a or b)) and @c` stood
would be read as `a or (b and @c)`.

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
