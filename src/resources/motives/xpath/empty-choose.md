# Empty choose

An `xsl:choose` exists to pick among `xsl:when` branches, so one with no
`xsl:when` is degenerate. XSLT requires at least one `xsl:when`, so a processor
rejects it; and even read loosely, an `xsl:choose` holding only an
`xsl:otherwise` is a wrapper that always runs its single branch — the
`xsl:choose` adds nothing.

The check is report-only until the full-fidelity parser (#228). Both
corrections — dropping the `xsl:choose` and keeping its `xsl:otherwise`
content, or adding the missing `xsl:when` — rewrite element structure, which
the fixer, editing one attribute or text span at a time, cannot express.

Incorrect:

```xsl
<xsl:template match="/objects">
  <xsl:choose>
    <xsl:otherwise>
      <xsl:text>fallback</xsl:text>
    </xsl:otherwise>
  </xsl:choose>
</xsl:template>
```

Correct:

```xsl
<xsl:template match="/objects">
  <xsl:text>fallback</xsl:text>
</xsl:template>
```
