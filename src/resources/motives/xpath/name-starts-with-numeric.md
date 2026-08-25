# Name starts with a numeric character

Variable, template, and function names must not start with a digit. Such a
name is not an identifier XPath can spell, so every reference to it is a
syntax error and a processor refuses the stylesheet rather than running it.

A function name is judged on its local part, the prefix being the namespace
and not the name: `my:9lives` is reported where `my:lives` is not.

An empty name starts with nothing rather than with a digit, and it is
`variable-or-param-without-name` that is about it. This check leaves it alone,
so that a name nobody wrote is reported once, and for what is wrong with it.

Incorrect:

```xsl
<xsl:variable name="1st" select="'first'"/>
```

Correct:

```xsl
<xsl:variable name="first" select="'first'"/>
```
