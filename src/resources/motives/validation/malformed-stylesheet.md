# Malformed stylesheet

A stylesheet that is not well-formed XML cannot be parsed into a document, so
nothing downstream can reason about it. It is reported once, and then skipped:
the other checks run only over the stylesheets that parse, so one broken file
never hides the feedback on the rest.

This is the first validator in the pipeline — validators establish that the
input is parseable, and the linters that follow assume it.

An unclosed element is the obvious way to break a stylesheet. Two others break
it without looking broken. An `&` in XML opens a reference, so `Tom & Jerry` is
not text holding an ampersand: the parser reads the `&` as the start of an entity
name and meets a space where a name has to begin. Write it `&amp;`, which is the
reference that stands for an ampersand. This bites hardest
in a URL, where `?page=2&sort=name` looks like every other query string and is
the commonest way a hand-written stylesheet stops being XML. An attribute value
must also be quoted — `select=$total` gives the parser nothing it can read as a
value, and the quotes are not optional the way they are in HTML.

The string `]]>` is reserved the same way. It closes a `<![CDATA[...]]>` section
and may stand nowhere else in content, whatever the author meant by it — three
characters that happen to fall together at the end of an array subscript or a
piece of quoted code are still the close of a section that never opened. Escape
the bracket or the angle: `]]&gt;` reads as the text it looks like.

Both are fine where they are not content. Inside a comment and inside a
processing instruction, XML reads neither as opening or closing anything, and
inside a CDATA section an `&` is ordinary text while a `]]>` is the close it is
there to be. `]]>` is also allowed in an attribute value, since an attribute is
not content.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <result>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <result/>
  </xsl:template>
</xsl:stylesheet>
```

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <a href="list?page=2&sort=name">Tom & Jerry</a>
    <xsl:value-of select=$total/>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <a href="list?page=2&amp;sort=name">Tom &amp; Jerry</a>
    <xsl:value-of select="$total"/>
  </xsl:template>
</xsl:stylesheet>
```

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <code>rows[cells[0]]> 1</code>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="/">
    <code>rows[cells[0]]&gt; 1</code>
  </xsl:template>
</xsl:stylesheet>
```
