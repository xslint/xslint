# A name that is missing or empty

Eleven XSLT elements are named by a `@name` that must be a QName —
`xsl:variable`, `xsl:param`, `xsl:with-param`, `xsl:template`, `xsl:function`,
`xsl:key`, `xsl:attribute-set`, `xsl:decimal-format`, `xsl:character-map`,
`xsl:mode` and `xsl:accumulator`. An empty string is not one. Neither is an
attribute that is not there at all, on the two elements that require it. In
both cases the stylesheet is a static error: a processor refuses to compile it
rather than running it and producing something odd, so the whole
transformation stops on a typo.

The empty spelling is the one that hides. `name=""` reads as a name at a
glance, survives a search for the attribute, and looks deliberate beside a
neighbour that has one — which is usually what it is, a name deleted mid-edit
and never written back, or an attribute value template that resolved to
nothing. Nothing about the element says which name was meant, so the fix is
always to write it rather than to remove the attribute: an `xsl:key` without a
key name has no reason to exist.

Incorrect:

```xsl
<xsl:variable name="" select="count(item)"/>
<xsl:key name="" match="section" use="@id"/>
<xsl:variable select="count(item)"/>
```

Correct:

```xsl
<xsl:variable name="items" select="count(item)"/>
<xsl:key name="sections" match="section" use="@id"/>
<xsl:variable name="total" select="count(item)"/>
```

An `xsl:output` also takes a `@name`, and an empty one there is a different
error with a different remedy, so it is left to the check that is about
serialization.
