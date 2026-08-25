# Name starts with a numeric character

Variable, template, and function names must not start with a digit. Such a
name is not an identifier XPath can spell, so every reference to it is a
syntax error and a processor refuses the stylesheet rather than running it.

A function name is judged on its local part, the prefix being the namespace
and not the name: `my:9lives` is reported where `my:lives` is not.

An empty name starts with nothing rather than with a digit, so it is outside
this check and left alone. It is wrong for its own reason — an empty string is
not a QName, and a processor refuses the stylesheet over it rather than running
it — and reporting that as a name beginning with a digit tells the reader
something untrue about their own code.

Incorrect:

```xsl
<xsl:variable name="1st" select="'first'"/>
```

Correct:

```xsl
<xsl:variable name="first" select="'first'"/>
```
