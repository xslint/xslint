# Not using @test

Each `xsl:if` and `xsl:when` must have a `test` attribute. It sets a
condition in the form of an XPath expression that returns true or false,
which determines whether the contents of the element will be fulfilled.

Incorrect:

```xsl
<xsl:when>
  <!-- body -->
</xsl:when>
```

or:

```xsl
<xsl:if>
  <!-- body -->
</xsl:if>
```

Correct:

```xsl
<xsl:when test="@ooo">
  <!-- body -->
</xsl:when>
```

or:

```xsl
<xsl:if test="@ooo">
  <!-- body -->
</xsl:if>
```
