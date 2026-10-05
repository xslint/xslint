# Use single option for choose

An `xsl:choose` with a single `xsl:when` and no `xsl:otherwise` says what an
`xsl:if` says, and sends its reader looking for a second branch that is not
there. Write the `xsl:if`. A `choose` that also has an `xsl:otherwise` is a
genuine if/else and is left alone, and a `choose` with no `xsl:when` at all is
reported by `empty-choose`, not here.

Incorrect:

```xsl
<xsl:choose>
  <xsl:when test="@active">Active</xsl:when>
</xsl:choose>
```

Correct:

```xsl
<xsl:if test="@active">Active</xsl:if>
```
