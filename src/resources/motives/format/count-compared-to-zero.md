# Count compared to zero

`count($x) &gt; 0` and `count($x) = 0` make the processor tally the whole
sequence only to learn whether it holds anything. Test existence directly, so
the engine can stop at the first item: `exists()` and `empty()` on XSLT 2.0
and later, the bare sequence and `not()` on 1.0.

Incorrect:

```xsl
<xsl:if test="count($items) &gt; 0">
<xsl:if test="count($items) = 0">
```

Correct:

```xsl
<xsl:if test="exists($items)">
<xsl:if test="empty($items)">
```

Either operand order and the value comparisons `eq`, `ne`, and `lt` are
flagged the same way. A genuine count, such as `count($x) &gt; 1`, is left
alone.
