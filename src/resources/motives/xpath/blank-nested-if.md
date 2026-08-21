# Blank nested if

Two nested `xsl:if` instructions state one condition in two places. A reader
holding the outer test in mind has to carry it into the inner one to see what
the body really depends on, and the nesting suggests the inner test is somehow
subordinate to the outer when both are simply conjuncts. One `xsl:if` joining
them with `and` says the same thing in one place.

Incorrect:

```xsl
<xsl:if test="$a">
  <xsl:if test="$b">
    <xsl:value-of select="."/>
  </xsl:if>
</xsl:if>
```

Correct:

```xsl
<xsl:if test="$a and $b">
  <xsl:value-of select="."/>
</xsl:if>
```

The collapse holds only while the outer `xsl:if` holds nothing but the inner
one. Anything else it holds is emitted whenever the outer test is true, and
joining the conditions makes that content wait on the inner test as well:

```xsl
<xsl:if test="$a">Ready: <xsl:if test="$b">
    <xsl:value-of select="."/>
  </xsl:if>
</xsl:if>
```

There the `Ready:` text is written for every `$a`, so the two instructions are not one.
Emit it before the outer `xsl:if`, or leave the nesting alone. Indentation
between the two is not content — XSLT strips whitespace-only text from a
stylesheet — and neither a comment nor a processing instruction reaches the
result tree, so none of the three stands in the way.
