# Invalid XPath expression

Every expression a stylesheet carries must be one the processor can parse, and a
stylesheet carries them in more places than its `select`. One is an attribute
holding a bare XPath — `select`, `test`, `use`, `value`, `group-by`,
`group-adjacent`, or the XSLT 3.0 `key`, `initial-value`, `xpath`,
`context-item`, `with-params`, `namespace-context`, the `for-each-item` and
`for-each-source` of an `xsl:merge-source`, and the static `use-when`. Another
is a pattern attribute: `match`, `count`, `from`, `group-starting-with`,
`group-ending-with`. And another is each expression a `{...}` encloses — in an
attribute value template, in the text of an XSLT 3.0 element whose `expand-text`
is on, or in a shadow attribute such as `_select`. A malformed expression breaks
the transformation at runtime wherever it stands, so the sooner it surfaces the
better. Only the syntax is checked, never the formatting.

A pattern is judged as a pattern, which is a narrower language than an
expression rather than a second reading of one. A pattern is matched by walking
*up* from a node, so it may only name a step such a walk can answer: `child` and
`attribute` at every version, joined by `self`, `descendant`,
`descendant-or-self` and `namespace` in XSLT 3.0, and never `parent`,
`ancestor`, `ancestor-or-self`, `following`, `following-sibling`, `preceding` or
`preceding-sibling`. A predicate inside it is an ordinary expression and may name
any of them. A pattern is also a union of paths and nothing else, so `1 + 1`,
`@a = 'b'` and `a, b` are all perfectly good expressions and none of them is a
pattern a processor will load.

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

Incorrect (a pattern cannot look sideways, so no processor loads this):

```xsl
<xsl:template match="following-sibling::para">
  <xsl:value-of select="."/>
</xsl:template>
```

Correct (name the nodes that match, and let a predicate look where it likes):

```xsl
<xsl:template match="para[preceding-sibling::*]">
  <xsl:value-of select="."/>
</xsl:template>
```
