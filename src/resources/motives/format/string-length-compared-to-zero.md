# String length compared to zero

`string-length($x) &gt; 0` and `string-length($x) = 0` measure the whole string
only to ask whether it holds any characters. The direct test says it plainly:
`$x != ''` for non-empty and `$x = ''` for empty. It reads better and stops at
the first character instead of counting them all. This is the same family as
comparing `count(...)` with zero to test existence.

Incorrect:

```xsl
<xsl:if test="string-length(@name) &gt; 0">
<xsl:if test="string-length(@name) = 0">
```

Correct:

```xsl
<xsl:if test="@name != ''">
<xsl:if test="@name = ''">
```

Given no argument the call measures the context item, which XPath spells `.`, so
`string-length() = 0` is a legal emptiness test and `. = ''` is the direct
reading of it.

The call is the standard `fn:string-length` however its namespace is spelled:
bare, behind a prefix bound to the XPath functions namespace
(`fn:string-length(@name) = 0`), or with that namespace written inline. A
function of your own that happens to be called `string-length` is another
function and is left alone.

From XSLT 2.0 the same test is often spelled with the value comparisons, and
`string-length(@name) eq 0` asks what `= 0` asks. The direct form keeps the class
it was given — a value comparison becomes `@name eq ''` and a general one
`@name = ''` — because the two are not interchangeable on a sequence of several
items, where the general form asks whether any of them is empty and the value
form raises an error. Dropping the call should not move a comparison from one
class into the other.

The operand order does not matter (`0 &lt; string-length(@name)` is flagged the
same way). A `0` or `1` that is only part of a wider arithmetic operand — the
`1` in `$max + 1 &gt; string-length(@a)`, the `0` in
`string-length(@a) &gt; 0 + $n` — does not compare the call against zero, and is
left alone. So is a call spelling two arguments, since no such function takes
any.

Where the argument binds at least as loosely as the comparison it would move
into, the rewrite cannot be written without brackets and the comparison is
reported on its own: `string-length(@a or @b) = 0` would become
`@a or @b = ''`, which XPath reads as `@a or (@b = '')`, and
`string-length(@a = @b) = 0` would chain two comparisons, which no version
admits. Everything binding tighter carries over as it stands, a union
(`string-length($a | $b)`) included, since `|` binds tighter than `=`.

`X op ''` is not a general equivalent of `string-length(X) op 0`, and the two
part ways in two cases. An **absent** node: `string-length(@x) = 0` is true when
`@x` is missing, the empty string having length zero, but `@x = ''` is false,
since an empty node-set matches nothing. The value comparison goes further and
answers the empty sequence there, `@x eq ''` having nothing to compare: it reads
as false in a test, as `@x = ''` does, and prints as nothing where the general
comparison prints `false`. Neither says what `string-length(@x) = 0` says of a
missing node, which is `true`. And a **multi-node** `X`, in XPath 1.0:
there `string-length` reads the first node's value while `X != ''` is true if
*any* node is non-empty, whereas on 2.0 and later a sequence of two or more
items raises `XPTY0004` and the original is already an error. For the common
single, present node the two agree. Use `normalize-space($x)` instead when
whitespace-only should read as empty — a different test again.
