# Literal text outside `xsl:text`

Literal text (other than whitespace) must not sit directly inside an `xsl:`
instruction. Wrap it in `xsl:text`. An instruction whose content is the value
it builds takes text directly, since there the text is that value rather than
output standing loose beside the instructions: `xsl:variable`, `xsl:param`,
`xsl:with-param`, `xsl:attribute`, `xsl:namespace`, `xsl:comment`,
`xsl:processing-instruction`, `xsl:message`, `xsl:assert`, and the content
forms of `xsl:value-of` and `xsl:sequence`. You can also use text inside
html-tags or in other non-XSL elements.

Incorrect:

```xsl
<xsl:if test=".!=''">
  Hello!
</xsl:if>
```

Correct:

```xsl
<xsl:if test=".!=''">
  <xsl:text>Hello!</xsl:text>
</xsl:if>
```

or:
```xsl
<xsl:variable name="Lord Byron">
  1788-1824
</xsl:variable>
```

or:
```xsl
<xsl:param name="William Shakespeare">
  1564-1616
</xsl:param>
```

or:
```xsl
<xsl:with-param name="Robert Burns">
  1759-1796
</xsl:with-param>
```

or:
```xsl
<xsl:attribute-set name="font">
  <xsl:attribute name="fname"> 
    Arial 
  </xsl:attribute>
</xsl:attribute-set>
```

or:
```xsl
<xsl:namespace name="dc">http://purl.org/dc/elements/1.1/</xsl:namespace>
```

or:
```xsl
<xsl:value-of>Robert Burns</xsl:value-of>
```

or:
```xsl
<xsl:comment>
  Text of comment.
</xsl:comment>
```

or:
```xsl
<xsl:processing-instruction name="xml-stylesheet">
    href="style.css" type="text/css"
</xsl:processing-instruction>
```

or:
```xsl
<xsl:message terminate="yes">
  text of message
</xsl:message>
```

or:
```xsl
<ul>
  <li>William Shakespeare</li>
  <li>Robert Burns</li>
  <li>Lord Byron</li>
</ul>
```

or:
```xsl
<ex:note xmlns:ex="https://example.com">
  some text
</ex:note>
```
