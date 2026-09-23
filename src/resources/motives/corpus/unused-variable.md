# Unused variable

A variable whose `$name` is referenced nowhere it is in scope — within its own
parent for a local one, or anywhere in the corpus (including a stylesheet that
imports it) for a top-level one — is dead code and should be removed. A
reference in a text value template, `<p>{$greeting}</p>` under an on
`expand-text`, reads the variable as surely as a `select` does.

Incorrect:

```xsl
<xsl:variable name="greeting" select="'Hello'"/>
<!-- $greeting is never referenced -->
```

Correct:

```xsl
<xsl:variable name="greeting" select="'Hello'"/>
<p><xsl:value-of select="$greeting"/></p>
```
