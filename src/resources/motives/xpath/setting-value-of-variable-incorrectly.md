# Setting value of variable incorrectly

A variable or a parameter whose body is one `xsl:value-of` builds a result
tree fragment to hold a value it has already computed: the instruction
evaluates its `select`, turns the result into a string, and writes that string
into a fragment the variable then names. The `select` attribute binds the value
itself, without the fragment. It is shorter to read and cheaper to run, and it
reads the same on an `xsl:param` default and on an `xsl:with-param` as on an
`xsl:variable`.

Incorrect:

```xsl
<xsl:variable name="title">
  <xsl:value-of select="heading"/>
</xsl:variable>
```

Correct, in XSLT 1.0:

```xsl
<xsl:variable name="title" select="string(heading)"/>
```

Correct, in XSLT 2.0 and later:

```xsl
<xsl:variable name="title" select="string-join(heading, ' ')"/>
```

The string is what the body was binding, so the `select` says so, and which
string it was depends on the version. In 1.0 `xsl:value-of` takes the string
value of the first `heading` alone, which is what `string(heading)` takes too.
From 2.0 on it takes every item and joins them with a space, and `string()` of
two headings is an error there, `XPTY0004`, so `string-join` is the spelling
that agrees.

Moving the expression over bare, as `select="heading"`, binds something else
on every version: the `heading` nodes themselves rather than one string made
of them. There `count($title)` counts the headings rather than one value,
`$title/@lang` reaches an attribute a string does not carry, and node identity
is the document's. Under an `as="xs:string"` it is worse: the first time two
headings arrive, the processor raises `XTTE0570`. Where the variable is only
ever read as a string of one item the forms agree, and nowhere else.

An `xsl:value-of` whose `separator` joins the items some other way names a
value one plain `select` has no way to say, and so does one that computes its
value from a body of its own rather than from a `select`:

```xsl
<xsl:variable name="joined">
  <xsl:value-of select="item" separator=","/>
</xsl:variable>
```

Neither is the shorthand this advice is about. On 2.0 and later the first can
still drop its fragment, as `select="string-join(item, ',')"`.

The shorthand needs the `xsl:value-of` to be the whole of the body. Text beside
it belongs to the fragment too, and `select` has nowhere to put it:

```xsl
<xsl:variable name="title">Chapter: <xsl:value-of select="heading"/></xsl:variable>
```

There the value is the `Chapter:` text and the heading, which one attribute cannot
express — use `select="concat('Chapter: ', heading)"` instead. Indentation is
usually not content, XSLT stripping whitespace-only text from a stylesheet, and
neither a comment nor a processing instruction reaches the fragment.

Usually, because `xml:space` decides it. Where the nearest ancestor declaring
that attribute sets it to `preserve`, the whitespace is part of the fragment:

```xsl
<xsl:variable name="title" xml:space="preserve">  <xsl:value-of select="heading"/></xsl:variable>
```

That binds two spaces and the heading, which `select="heading"` does not —
`select="concat('  ', heading)"` is the shorthand there. A nearer
`xml:space="default"` cancels a `preserve` higher up.

The shorthand also needs the variable to carry no `select` of its own. One
holding both a `select` and a body offers a processor two candidate values and
no rule for choosing between them, which XSLT forbids outright — 1.0 calls it
an error, 2.0 and 3.0 raise `XTSE0620`, and the stylesheet compiles on no
version:

```xsl
<xsl:variable name="title" select="'Chapter'">
  <xsl:value-of select="heading"/>
</xsl:variable>
```

Neither form of the shorthand resolves that one, both values being spelled
already. Drop whichever of the two says what was meant, and the variable binds
one value again. XSLT 3.0's shadow spelling `_select` is the same attribute
computed at compile time, so it stands in the way exactly as the plain one
does.
