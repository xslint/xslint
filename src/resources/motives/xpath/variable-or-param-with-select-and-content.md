# Using internal content and @select to set a variable, param or with-param

An xsl:variable, an xsl:param and an xsl:with-param — the variable-binding
elements — take their value either from a @select expression or from their
body, never from both. Given both, a processor holds two candidate values and
no rule for choosing one, so XSLT forbids the combination outright: 1.0 calls
it an error, 2.0 and 3.0 raise the static error XTSE0620. The stylesheet does
not run at all, on any version, hence the error severity. A body of nothing
but whitespace and comments is not content, and is left alone.

`--fix-suggestions` deletes the `@select` and leaves the body as the value. It
is a suggestion rather than a safe fix: the body binds a tree — a document node
on 2.0 and later, a result tree fragment on 1.0 — where the expression bound
its own type, so `$physicist` stops being a string, and an `@as` the body
cannot convert to turns the edit into a type error. Dropping the body instead
is the other correction, and no single edit expresses it — make that one by
hand when the `@select` held the value you meant.

Incorrect:

```xsl
<xsl:variable name="physicist" select="'Isaac Newton'">
    Albert Einstein
</xsl:variable>
```

or:

```xsl
<xsl:call-template name="cite">
  <xsl:with-param name="physicist" select="'J.J. Thomson'">
    Max Planck
  </xsl:with-param>
</xsl:call-template>
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

A body of nothing but whitespace is no content at all, XSLT stripping such a
text node from the stylesheet before a processor reads it, so a `select` beside
it is fine. `xml:space` is the exception, and there the error is real:

```xsl
<xsl:variable name="mayor" select="'Ivanov'" xml:space="preserve">   </xsl:variable>
```

The three spaces survive, so the element has both a `select` and content.
SaxonJ-HE 12.5 refuses to compile that, reporting `XTSE0620`. Drop whichever
of the two says what was meant. A nearer `xml:space="default"` cancels a
`preserve` higher up, and the body is empty again.
