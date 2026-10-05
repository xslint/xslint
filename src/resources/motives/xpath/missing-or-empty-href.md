# An href that names no module

`@href` is what tells `xsl:import` and `xsl:include` which module to pull in.
Without one the processor refuses the stylesheet (`XTSE0010`), and an empty one
names the stylesheet itself, which is refused too. An empty `href` is usually a
module moved or a path deleted mid-edit. Write the path of the module meant.

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

The XSLT 3.0 spelling `_href` is checked the same way.
