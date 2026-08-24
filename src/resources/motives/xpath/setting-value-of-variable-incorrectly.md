# Setting value of variable incorrectly

A variable whose body is one `xsl:value-of` builds a result tree fragment to
hold a value it has already computed: the instruction evaluates its `select`,
turns the result into a string, and writes that string into a fragment the
variable then names. The `select` attribute binds the value itself, without the
fragment. It is shorter to read and cheaper to run.

Incorrect:

```xsl
<xsl:variable name="title">
  <xsl:value-of select="heading"/>
</xsl:variable>
```

Correct:

```xsl
<xsl:variable name="title" select="heading"/>
```

The two forms are close in intent and not equal in type, so the change is one to
make deliberately. The body binds a fragment whose string value is the first
`heading`; `select` binds the `heading` nodes themselves. Where the variable is
only ever read as a string the two agree, and where it is not they part:
`count($title)` counts one fragment against however many headings there are,
`$title/@lang` reaches an attribute the fragment does not carry, and node
identity is the fragment's rather than the document's. Read how the variable is
used before rewriting it, and where the string is what is wanted, say so —
`select="string(heading)"` states the conversion the body was doing silently.

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
