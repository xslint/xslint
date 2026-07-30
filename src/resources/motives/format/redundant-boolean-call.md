# Redundant boolean call

The `@test` of an `xsl:if` or `xsl:when` already coerces its value to a boolean,
so wrapping the whole thing in `boolean(...)` adds nothing — `test="boolean(x)"`
and `test="x"` behave identically. The wrapper is just noise.

The check fires only when the entire `@test` is one `boolean(...)` call, where
dropping it is always safe, so `--fix` removes it. A `boolean(...)` that is only
part of a larger expression — `a = boolean(b)` — is left alone, because there
the coercion can change what the comparison means.

Only the `@test` of an XSLT element is read. Nothing coerces the expression of an
attribute value template, so `&lt;div flag="{boolean(x)}"/&gt;` prints `true` or
`false` where a bare `{x}` would print the node's own text — the wrapper is doing
real work there and is kept. An attribute of your output vocabulary called `test`
is text for the result tree, and is never read as XPath.

Incorrect:

```xsl
<xsl:if test="boolean(@enabled)">
```

Correct:

```xsl
<xsl:if test="@enabled">
```
