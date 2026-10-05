# Unused named template

A named template that nothing runs is dead code: it costs the reader time and
drifts out of date unnoticed. Remove it, or call it.

The check reads every stylesheet linted together, so lint the whole project at
once to let it see every caller. A template that only calls itself, or a loop
of templates calling only each other, is reported too. A template named
`xsl:initial-template`, under any prefix, is left alone, since the processor
enters it directly.

Incorrect:

```xsl
<xsl:template name="footer">
  <footer>Copyright 2026</footer>
</xsl:template>
<!-- xsl:call-template name="footer" never appears in this stylesheet -->
```

Correct:

```xsl
<xsl:template name="footer">
  <footer>Copyright 2026</footer>
</xsl:template>

<xsl:template match="/">
  <xsl:call-template name="footer"/>
</xsl:template>
```
