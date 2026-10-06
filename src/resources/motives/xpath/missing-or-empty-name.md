# A name that is missing or empty

An empty `name=""` holds no QName, so the stylesheet is a static error and no
processor compiles it. It usually marks a name deleted mid-edit, and nothing
says which name was meant, so write it back. A missing `@name` fails the same
way on an element that requires one.

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

An `xsl:template`, `xsl:mode`, or `xsl:decimal-format` may leave its name out,
though never empty. The XSLT 3.0 spelling `_name=""` is empty too.
