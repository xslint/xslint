# Empty content in instructions

Instruction elements such as `xsl:for-each` and `xsl:if` with no content
produce no output and are almost certainly a mistake. An empty `xsl:when` or
`xsl:otherwise` is a deliberate "this case produces nothing" and is left
alone — the latter is exactly what `use-choose-without-otherwise` asks for.

Incorrect:

```xsl
<xsl:for-each select="item">
</xsl:for-each>
```

Correct:

```xsl
<xsl:for-each select="item">
  <xsl:value-of select="."/>
</xsl:for-each>
```

An instruction holding nothing but whitespace counts as empty, since XSLT
strips a whitespace-only text node from the stylesheet before a processor looks
at it. `xml:space` is the exception: where the nearest ancestor declaring it
says `preserve`, that whitespace survives and the instruction writes it out, so
removing the element changes the output and it is left alone.

```xsl
<xsl:if test="$a" xml:space="preserve">   </xsl:if>
```

That emits three spaces for every `$a`. A nearer `xml:space="default"` cancels
a `preserve` higher up, and the element is empty again.
