# Invalid XPath expression

An attribute carrying a bare XPath expression — `select`, `test`, `use`,
`value`, `group-by`, `group-adjacent`, or the XSLT 3.0 `key`, `initial-value`,
`xpath`, `context-item`, `with-params`, `namespace-context`, the
`for-each-item` and `for-each-source` of an `xsl:merge-source`, and the static
`use-when` — must hold an expression the processor can parse. A malformed
expression breaks the transformation at runtime, so the sooner it surfaces the
better. Only the
expression syntax is checked, not its formatting; pattern attributes such as
`match` and attribute value templates are left to other checks.

The expression is read under the version the stylesheet declares, because the
same characters are a different language under a different one. `1 cast as
xs:integer` is an expression in XSLT 2.0 and a syntax error in 1.0, where XPath
has no `cast as` and reads the same text as the name `cast` beside the name
`as`; `map {"a": 1}`, `$a => f()` and `a intersect b` are the same story at
their own versions. So an expression reported here may be perfectly good XPath
under a later version, and the fix is sometimes the stylesheet's `version`
rather than the expression.

Every prefix resolves while parsing, so an unknown prefix or a custom function
is never mistaken for a syntax error. Neither is a static-type mismatch:
`substring-before($spans, ':') - 1` reads a numeric prefix in XPath 1.0 and is
a type error in later versions, but that is what the expression *means*, not
whether it parses. The `namespace::` axis is left alone at every version, since
1.0 and 2.0 define it and a stylesheet raised to 3.0 keeps the steps it was
written with. Whitespace the grammar allows is not a mistake either — a gap
around the `::` of an axis, or on either side of what a node test brackets, so
`child :: a`, `parent::node ( )` and `element( a )` are read as the steps
`child::a`, `parent::node()` and `element(a)` name. Only genuine syntax
mistakes are reported.

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
