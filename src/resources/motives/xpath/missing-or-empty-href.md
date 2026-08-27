# An href that names no module

`xsl:import` and `xsl:include` exist to name another stylesheet module, and
`@href` is the only thing on them that does it. With none there is nothing to
pull in, and a processor refuses the whole stylesheet — `XTSE0010`, a required
attribute missing — rather than loading it and leaving the templates that
module was to supply quietly undefined. An empty one is not the milder case: a
relative reference of no characters is the module itself, so the stylesheet
imports or includes its own source, and that is refused too, under `XTSE0210`
for an import and `XTSE0180` for an include.

The empty spelling is the one that hides. `href=""` survives a search for the
attribute and reads as a placeholder somebody meant to fill, which is usually
what it is — a module moved, a path deleted mid-edit, or an attribute value
template that resolved to nothing. Nothing about the element says which module
was meant, so the repair is always to write the path rather than to drop the
attribute: an `xsl:include` that includes nothing has no reason to stand.

Incorrect:

```xsl
<xsl:import/>
<xsl:include href=""/>
```

Correct:

```xsl
<xsl:import href="common/attributes.xsl"/>
<xsl:include href="common/tables.xsl"/>
```

`xsl:result-document` carries an `@href` as well, and leaving it out there says
something else entirely — write to the principal result — so an absent one is
no fault at all and this is not about it.
