# String length compared to zero

`string-length($x) &gt; 0` and `string-length($x) = 0` count every character
only to ask whether there are any. Test the value directly: `$x != ''` for
non-empty and `string($x) = ''` for empty. The empty test keeps `string()`
because a bare `@name = ''` is false where `@name` is absent.

Incorrect:

```xsl
<xsl:if test="string-length(@name) &gt; 0">named</xsl:if>
<xsl:if test="string-length(@name) = 0">unnamed</xsl:if>
```

Correct:

```xsl
<xsl:if test="@name != ''">named</xsl:if>
<xsl:if test="string(@name) = ''">unnamed</xsl:if>
```

Either operand order is flagged, with `=` or `eq`, and so are `&gt;= 1` and
`&lt; 1`, which ask the same question.
