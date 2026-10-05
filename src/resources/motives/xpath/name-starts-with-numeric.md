# Name starts with a numeric character

A variable, parameter, template, or function name that starts with a digit is
no QName, so a processor refuses the stylesheet, and no expression could name
it anyway: `$1st` is a syntax error in XPath. Start the name with a letter.

Incorrect:

```xsl
<xsl:param name="1st" select="'first'"/>
```

Correct:

```xsl
<xsl:param name="first" select="'first'"/>
```

The local part is judged, so `my:9lives` is reported as well.
