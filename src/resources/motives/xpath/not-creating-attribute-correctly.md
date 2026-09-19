# Not creating attribute correctly

The attribute analog of `not-creating-element-correctly`. When an `xsl:attribute`
with a static name sits on a literal result element and its value is simple — a
single `xsl:value-of`, plain text, or empty — it can be written inline as a
literal attribute, with an attribute value template for a computed value:

```xsl
<td>
  <xsl:attribute name="class"><xsl:value-of select="@c"/></xsl:attribute>
  <xsl:attribute name="role">cell</xsl:attribute>
```

becomes

```xsl
<td class="{@c}" role="cell">
```

The inline form is shorter and keeps the attribute next to the element it
belongs to. `xsl:attribute` earns its place when the name is computed (an AVT),
the value needs instructions an AVT cannot hold (an `xsl:choose`), or the parent
is itself an instruction such as `xsl:element` or `xsl:copy` — those are left
alone.

Two shapes cannot be written inline at all, whatever they look like. An
`xsl:attribute` carrying `@namespace` puts the attribute in a namespace, and a
literal attribute on a literal result element takes the one its own prefix
binds — so inlining it moves the attribute. An `xsl:value-of` carrying
`@separator` joins a sequence with the string it names, where the braces of an
attribute value template join one with a single space, so the inline form
writes something else whenever the value is more than one item.

Position is the third. A literal attribute is written before the element's
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
