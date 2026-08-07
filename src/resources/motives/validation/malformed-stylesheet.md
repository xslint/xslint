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

An `&` is fine where it is not character data: inside a comment, inside a
`<![CDATA[...]]>` section, and inside a processing instruction, XML does not read
it as opening anything.

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
