# Blank nested if

Two nested `xsl:if` instructions state one condition in two places, and the
nesting suggests the inner test depends on the outer when both are only
conjuncts. One `xsl:if` joining them with `and` says it in one place.

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

Only an outer `xsl:if` holding nothing but the inner one is reported. From XSLT
2.0 on, `and` may evaluate either operand first, so leave the pair nested when
the outer test guards the inner one, as a `castable as` guards a cast.
