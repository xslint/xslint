# Translate for case

A `translate()` spelling out both alphabets folds case over ASCII alone, so
accented and other non-ASCII letters pass through unchanged, and the reader has
to check 52 letters to see what it does. XSLT 2.0 has `lower-case()` and
`upper-case()`, which say what they mean and fold all of Unicode.

Incorrect:

```xsl
<xsl:value-of select="translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"/>
```

Correct:

```xsl
<xsl:value-of select="lower-case(@id)"/>
```

Only XSLT 2.0 and 3.0 stylesheets are checked, and only a `translate()` whose
two arguments are the full upper and lower ASCII alphabets.
