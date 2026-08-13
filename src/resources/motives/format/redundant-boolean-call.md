# Redundant boolean call

`boolean(x)` computes the effective boolean value of `x` — which is the very
thing XSLT and XPath compute for themselves wherever a truth is what they are
after. The `@test` of an `xsl:if` or an `xsl:when` is such a place, and so is
each operand of `and` and `or`, the argument of `not()`, the condition of an `if`
expression and the body of a `satisfies`. In all of them `boolean(x)` behaves
exactly as `x` does, so the wrapper says nothing and the reader has to look past
it to find the condition.

Where the value itself is wanted, the call is doing real work and belongs.
Comparing with it is one such place: `@a = boolean(@b)` compares a string with a
boolean, and without the call two strings are compared instead. A predicate is
another, and a sharper one, because XPath reads a numeric predicate as a test on
the context position — `item[boolean(count(e))]` selects every `item` with an `e`
under it, while `item[count(e)]` selects the one whose position equals that
count. Printing is a third: `<div flag="{boolean(x)}"/>` prints `true` or
`false`, where `{x}` prints the node's own text.

An attribute of your own output vocabulary called `test` is text for the result
tree, and is never read as XPath.

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
