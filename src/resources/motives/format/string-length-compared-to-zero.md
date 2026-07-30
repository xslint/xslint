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

The operand order does not matter (`0 &lt; string-length(@name)` is flagged the
same way). A `0` or `1` that is only part of a wider arithmetic operand — the
`1` in `$max + 1 &gt; string-length(@a)`, the `0` in
`string-length(@a) &gt; 0 + $n` — does not compare the call against zero, and is
left alone. When the argument is not a single operand — a union such as
`string-length($a | $b)`, where `X != ''` would not mean the same thing — the
comparison is still reported but carries no fix.

The rewrite is offered as a **suggestion**, not a safe fix, because `X op ''` is
not a general equivalent of `string-length(X) op 0`. They part ways in two
cases: an **absent** node — `string-length(@x) = 0` is true when `@x` is
missing (the empty string has length zero), but `@x = ''` is false, since an
empty node-set matches nothing; and a **multi-node** `X` — `string-length` reads
the first node's value while `X != ''` is true if *any* node is non-empty. For
the common single, present node the two agree, so `--fix-suggestions` applies
it; plain `--fix` leaves it. Use `normalize-space($x)` instead when
whitespace-only should read as empty — a different test again.
