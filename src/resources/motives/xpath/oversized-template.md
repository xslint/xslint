# Oversized template

A template holding more than 100 XSLT elements is hard to read or change as
one piece, and does by hand what template matching would do for it. Let it do
a small part and delegate the rest with `xsl:apply-templates` to focused
templates.

Incorrect:

```xsl
<xsl:template match="/">
  <!-- more than 100 xsl:* elements: choose, if, for-each, value-of ... -->
</xsl:template>
```

Correct:

```xsl
<xsl:template match="/">
  <xsl:apply-templates select="header"/>
  <xsl:apply-templates select="section"/>
  <xsl:apply-templates select="footer"/>
</xsl:template>

<xsl:template match="section">
  <!-- one focused piece of the work -->
</xsl:template>
```

Elements are counted, not lines, so literal result markup does not add to the
size. A large `xsl:function` is covered by `function-complexity`.
