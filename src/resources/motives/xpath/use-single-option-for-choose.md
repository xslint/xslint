# Use single option for choose

An `xsl:choose` with a single `xsl:when` and no `xsl:otherwise` says what an
`xsl:if` says, so a stylesheet holding both forms sends its reader through every
`choose` to look for a second branch that is not there. One way to say one
thing keeps a single condition an `xsl:if`, the instruction XSLT gives it. A
`choose` that also has an
`xsl:otherwise` is a genuine if/else and is left alone, and a `choose` with no
`xsl:when` at all is reported by `empty-choose`, not here.

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
