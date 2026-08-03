# Invalid XPath expression

An attribute carrying a bare XPath expression — `select`, `test`, `use`,
`value`, `group-by`, `group-adjacent`, or the XSLT 3.0 `key`, `initial-value`,
`xpath`, `context-item`, `with-params`, `namespace-context` — must hold an
expression the processor can parse. A malformed expression breaks the
transformation at runtime, so the sooner it surfaces the better. Only the
expression syntax is checked, not its formatting; pattern attributes such as
`match` and attribute value templates are left to other checks.

The expression is parsed by the same engine that evaluates the rules, so it is
valid here exactly when the processor can parse it. Every prefix resolves
while parsing, so an unknown prefix or a custom function is never mistaken for
a syntax error. Neither is a static-type mismatch: the engine is XPath 3.1, so
it rejects the implicit string-to-number coercion an XPath 1.0 stylesheet leans
on — `substring-before($spans, ':') - 1` reads a numeric prefix in 1.0 — but
that is a dialect difference, not a broken expression, so it is not reported.
The `namespace::` axis is another such difference — XPath 3.0 dropped it, but
1.0 and 2.0 define it, so `namespace::*` is left alone. So is a step spaced
inside itself: a gap around the `::` of an axis, or in front of the bracket of
a node test, is whitespace the grammar allows, so `child :: a` and
`parent::node ( )` are read as the steps `child::a` and `parent::node()` name.
Only genuine syntax mistakes are reported.

Incorrect (`==` is not an XPath operator):

```xsl
<xsl:if test="foo(a) == 'hello'">
  <xsl:value-of select="."/>
</xsl:if>
```

Correct:

```xsl
<xsl:if test="foo(a) = 'hello'">
  <xsl:value-of select="."/>
</xsl:if>
```
