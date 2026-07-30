# Using internal content and @select to set variable or param

An xsl:variable or xsl:param must not set its value both ways.
When it carries a @select attribute and also has content, the
binding is ambiguous, so keep only one. It is a static error, which a
conformant processor rejects, so this is graded an error.

The check is report-only: which half to drop — the `@select` or the
body — changes the value that gets bound, so it is a judgement call the
tool cannot make for you.

Incorrect:

```xsl
<xsl:variable name="physicist" select="'Isaac Newton'">
    Albert Einstein
</xsl:variable>
```
or:
```xsl
<xsl:param name="physicist" select="'J.J. Thomson'">
    Max Planck
</xsl:param>
```

Correct:

```xsl
<xsl:variable name="physicist">
    Marie Curie
</xsl:variable>
```
or:
```xsl
<xsl:variable name="physicist" select="'Ernest Rutherford'"/>
```
or:
```xsl
<xsl:param name="physicist">
    Galileo Galilei
</xsl:param>
```
or:
```xsl
<xsl:param name="physicist" select="'Lev Landau'"/>
```
