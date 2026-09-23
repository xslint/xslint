# Not creating attribute correctly

The attribute analog of `not-creating-element-correctly`. When an `xsl:attribute`
with a static name sits on a literal result element and its value is simple — a
single `xsl:value-of`, a single `xsl:text`, plain text, or empty — it can be
written inline as a literal attribute, with an attribute value template for a
computed value:

```xsl
<td>
  <xsl:attribute name="class"><xsl:value-of select="@c"/></xsl:attribute>
  <xsl:attribute name="role">cell</xsl:attribute>
```

becomes

```xsl
<td class="{@c}" role="cell">
```

A brace is the one thing the move asks of the author. Inside a literal
attribute a `{` opens an attribute value template, where inside an
`xsl:attribute` it is just a character, so a literal brace is doubled on the
way in: `<xsl:attribute name="id"><xsl:text>{7F}</xsl:text></xsl:attribute>`
is `id="{{7F}}"` and not `id="{7F}"`, which would evaluate `7F` as an
expression.

The inline form is shorter and keeps the attribute next to the element it
belongs to. `xsl:attribute` earns its place when the name is computed (an AVT),
the value needs instructions an AVT cannot hold (an `xsl:choose`), or the parent
is itself an instruction such as `xsl:element` or `xsl:copy` — those are left
alone.

Several shapes cannot be written inline at all, whatever they look like. An
`xsl:attribute` carrying `@namespace` puts the attribute in a namespace, and a
literal attribute on a literal result element takes the one its own prefix
binds — so inlining it moves the attribute. An `xsl:value-of` carrying
`@separator` joins a sequence with the string it names, where the braces of an
attribute value template join one with a single space, so the inline form
writes something else whenever the value is more than one item. An `xsl:text`
carrying `@disable-output-escaping` asks the serializer for something a
literal attribute has no way to say, and inside an attribute what it asks for
is an error a processor may signal or ignore as it chooses, so rewriting it
would pick one of those readings. An `xsl:attribute` carrying `@separator`,
`@type` or `@validation` asks for something no literal attribute can carry:
its own separator, where an attribute value template joins with a space, or a
type annotation and validation a literal attribute has no attribute to say.
And an attribute the start tag already writes cannot be written there twice,
since a second `class` on one element is not well-formed XML.

Scope is another. A variable declared in the element's content is in scope
for what follows it and not for the element's own start tag, so a value
reading it cannot move there:

```xsl
<fo:table-column>
  <xsl:variable name="width" select="@w"/>
  <xsl:attribute name="column-width">
    <xsl:value-of select="$width"/>
  </xsl:attribute>
</fo:table-column>
```

is left alone, since `<fo:table-column column-width="{$width}">` reads a
variable nothing has declared there.

Position is the last. A literal attribute is written before the element's
content is instantiated, so anything standing in front of the `xsl:attribute`
that can supply an attribute of its own — an `xsl:copy-of`, an
`xsl:apply-templates` or an `xsl:call-template` over attributes, bare or inside
a conditional — overrides the inline form where the `xsl:attribute` overrides
it. Here

```xsl
<out>
  <xsl:apply-templates select="@*"/>
  <xsl:attribute name="hop">new</xsl:attribute>
</out>
```

emits `hop="new"` over a source `<o hop="old"/>`, and

```xsl
<out hop="new">
  <xsl:apply-templates select="@*"/>
</out>
```

emits `hop="old"`. The same holds for an earlier `xsl:attribute` repeating the
name, or naming it through an attribute value template that might evaluate to
it. Where a predecessor can reach the name, the two forms say different things
and only reordering the stylesheet makes them agree.
