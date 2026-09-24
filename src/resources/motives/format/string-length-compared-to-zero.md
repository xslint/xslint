# String length compared to zero

`string-length($x) &gt; 0` and `string-length($x) = 0` measure the whole string
only to ask whether it holds any characters. The direct test says it plainly:
`$x != ''` for non-empty and `string($x) = ''` for empty. It reads better and
stops at the first character instead of counting them all. This is the same
family as comparing `count(...)` with zero to test existence.

Incorrect:

```xsl
<xsl:if test="string-length(@name) &gt; 0">
<xsl:if test="string-length(@name) = 0">
```

Correct:

```xsl
<xsl:if test="@name != ''">
<xsl:if test="string(@name) = ''">
```

The empty test keeps the `string()` call because a missing attribute is empty
too. `string-length(@name) = 0` is true where `@name` is absent, and so is
`string(@name) = ''`, but a bare `@name = ''` is false there, since a
comparison with an empty node-set matches nothing. A call that always answers
a string, such as `normalize-space(@name)`, is never absent, so
`normalize-space(@name) = ''` needs no wrapper.

Given no argument the call measures the context item, which XPath spells `.`, so
`string-length() = 0` is a legal emptiness test and `. = ''` is the direct
reading of it.

The call is the standard `fn:string-length` however its namespace is spelled:
bare, behind a prefix bound to the XPath functions namespace
(`fn:string-length(@name) = 0`), or with that namespace written inline. A
function of your own that happens to be called `string-length` is another
function and is left alone.

From XSLT 2.0 the same test is often spelled with the value comparisons, and
`string-length(@name) eq 0` asks what `= 0` asks. The direct form keeps the
class it was given — a value comparison becomes `string(@name) eq ''` and a
general one `string(@name) = ''` — because the two are not interchangeable on a
sequence of several items, where the general form asks whether any of them is
empty and the value form raises an error. Dropping the call should not move a
comparison from one class into the other.

The operand order does not matter (`0 &lt; string-length(@name)` is flagged the
same way). A `0` or `1` that is only part of a wider arithmetic operand — the
`1` in `$max + 1 &gt; string-length(@a)`, the `0` in
`string-length(@a) &gt; 0 + $n` — does not compare the call against zero, and is
left alone. So is a call spelling two arguments, since no such function takes
any.

Where the argument binds at least as loosely as the comparison it would move
into, a non-emptiness rewrite cannot be written without brackets and the
comparison is reported on its own — an emptiness rewrite already brackets it in
`string(...)`: `string-length(@a or @b) > 0` would become
`@a or @b != ''`, which XPath reads as `@a or (@b != '')`, and
`string-length(@a = @b) > 0` would chain two comparisons, which no version
admits. Everything binding tighter carries over as it stands, a union
(`string-length($a | $b)`) included, since `|` binds tighter than `=`.

The empty test is exact: `string(X)` reads what `string-length(X)` measures, the
first node's value in XPath 1.0 and the one item in 2.0, and `''` where `X` is
absent. The non-empty test needs no `string()`, since `@x != ''` and
`string-length(@x) > 0` are both false on a missing node, but it is not exact
either on a **multi-node** `X` in XPath 1.0. There `string-length` reads the
first node's value while `X != ''` is true if *any* node is non-empty, whereas
on 2.0 and later a sequence of two or more items raises `XPTY0004` and the
original is already an error. For a single node the two agree. Use
`normalize-space($x)` instead when whitespace-only should read as empty — a
different test again.
