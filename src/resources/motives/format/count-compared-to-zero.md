# Count compared to zero

`count($x) &gt; 0` and `count($x) = 0` ask the processor to walk the whole
sequence and tally it, only to find out whether it holds anything. The question
is existence, and every version of XPath can state it directly — and let the
engine stop at the first item instead of counting every one.

Incorrect:

```xsl
<xsl:if test="count($items) &gt; 0">
<xsl:if test="count($items) = 0">
```

Correct, on XSLT 2.0 and later:

```xsl
<xsl:if test="exists($items)">
<xsl:if test="empty($items)">
```

Correct, on XSLT 1.0 (where `exists()`/`empty()` do not exist):

```xsl
<xsl:if test="$items">
<xsl:if test="not($items)">
```

A node-set in a boolean context is already true exactly when it is non-empty, so
wherever nothing but a truth is taken the bare `$items` says it — a whole
`@test` or `@use-when`, an operand of `and` or `or`, the argument of `not()`, an
`if` condition, a `satisfies` body. Only where a value is taken rather than a
truth, a `@select` or an attribute value template among them, does the wrapper
earn its place:

```xsl
<xsl:if test="@heading and $items">
<xsl:variable name="any" select="boolean($items)"/>
```

The empty case is `not($items)` either way. The 1.0 forms are valid in every
version, so an unversioned stylesheet can use them too.

The call is the standard `fn:count` however its namespace is spelled: bare, as
the default function namespace; behind a prefix bound to that namespace, which is
the idiomatic `fn:count($items) = 0` of a 2.0 stylesheet; or with the namespace
written inline. A function of your own that happens to be called `count` is
another function and is left alone, and so is a call spelling no argument or
several, `fn:count` taking exactly one.

Nor does the operator's spelling. XSLT 2.0 brought the value comparisons, which
ask the same six questions in words, so `count($items) eq 0`,
`count($items) ne 0` and `0 lt count($items)` are the existence tests `= 0`,
`!= 0` and `0 &lt;` are, and collapse to the same `exists()`/`empty()` — the
direct form is a call and carries no operator, so nothing of the original
spelling is lost in dropping it.

The operand order does not matter: `0 &lt; count($items)` and
`0 = count($items)` are flagged the same way. A comparison that is not an
existence test — `count($x) &gt; 1`, `count($x) = 5` — is a genuine count and is
left alone. So is a `0` or `1` that is only part of a wider operand: in
`$max + 1 &gt; count($x)` the left side is `$max + 1`, and in
`count($x) &gt; 0 + $n` the right side is `0 + $n`, so neither compares the call
against a bare `0` or `1`.

The comparison is caught in the XPath and pattern attributes of XSLT elements and
inside an attribute value template, where `&lt;div empty="{count($items) = 0}"/&gt;`
holds a real expression; both a comparison and its rewrite print `true`/`false`
there, so the fix stays safe. An attribute of your output vocabulary that happens
to be called `test` or `select` carries text for the result tree, not XPath, and
is never touched.
