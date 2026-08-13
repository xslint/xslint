# Translate for case

The XSLT 1.0 way to change case is a `translate()` spelling out both alphabets:

```xsl
translate(@ident, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')
```

XSLT 2.0 added `lower-case()` and `upper-case()`, which are shorter, say what
they mean, and fold all of Unicode rather than only ASCII. In a 2.0 or 3.0
stylesheet the `translate` spell-out is an anachronism.

Incorrect:

```xsl
<xsl:value-of select="translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"/>
```

Correct:

```xsl
<xsl:value-of select="lower-case(@id)"/>
```

The check fires only in XSLT 2.0 and 3.0 — in 1.0 the `translate` form is the
only option, so it is not a defect. Either alphabet may be quoted either way and
the two need not agree, so `translate(@id, "A...Z", 'a...z')` is the same
anachronism spelled to suit the attribute it stands in.

A `translate` with any other pair of arguments is left alone, a near alphabet
included: an alphabet missing a letter maps that letter to nothing, which is a
deletion rather than a case fold.
