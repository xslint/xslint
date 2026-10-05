# Redundant whitespace

`@type = 'index'` and `@type = 'index'` are the same test, yet a search for one
misses the other, and a commit that tidies the spacing buries the line that
changed. Remove the doubled and stray spaces.

Incorrect (a doubled space and a trailing space):

```xsl
<xsl:if test="foo(  a) = 'hello' ">
  <xsl:value-of select="."/>
</xsl:if>
```

Correct:

```xsl
<xsl:if test="foo(a) = 'hello'">
  <xsl:value-of select="."/>
</xsl:if>
```

A run is redundant when it is longer than one space within a line, or stands at
the start or end of the expression. Whitespace in a string literal or a comment,
and the indentation of an expression wrapped across lines, are left alone.
