# A name that is missing or empty

Twelve XSLT elements are named by a `@name` that must be a QName —
`xsl:variable`, `xsl:param`, `xsl:with-param`, `xsl:call-template`,
`xsl:template`, `xsl:function`, `xsl:key`, `xsl:attribute-set`,
`xsl:decimal-format`, `xsl:character-map`, `xsl:mode` and `xsl:accumulator`. An
empty string is not one, on any of them: the stylesheet is a static error, so a
processor refuses to compile it rather than running it and producing something
odd, and the whole transformation stops on a typo. Leaving the attribute out
altogether is a different fault — nine of the twelve must carry one, while
`xsl:template`, `xsl:mode` and `xsl:decimal-format` are named by choice, and an
absent `@name` on those three asks for the unnamed default rather than for
nothing.

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
<xsl:call-template name=""/>
<xsl:variable select="count(item)"/>
```

Correct:

```xsl
<xsl:variable name="items" select="count(item)"/>
<xsl:key name="sections" match="section" use="@id"/>
<xsl:call-template name="summary"/>
<xsl:variable name="total" select="count(item)"/>
```

An `xsl:output` also takes a `@name`, and an empty one there is a different
error with a different remedy, so it is left to the check that is about
serialization.
