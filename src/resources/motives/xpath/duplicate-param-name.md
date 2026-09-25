# Duplicate `xsl:param` name

The parameters of a template, a stylesheet function, or the stylesheet itself
form one namespace: each must have a distinct name. Two parameters sharing a
name is a static error — the processor cannot tell which one a reference binds
to — and rejects the stylesheet.

A name is compared the way the processor compares it, as an expanded QName
rather than as text. `p:size` and `q:size` are one name when both prefixes are
bound to the same namespace URI, `size` and `Q{}size` are one name, and the
whitespace around a name is ignored. Respelling a prefix does not make two
parameters distinct; giving them different local names does.

Incorrect:

```xsl
<xsl:template name="render" xmlns:p="urn:a" xmlns:q="urn:a">
  <xsl:param name="p:size"/>
  <xsl:param name="q:size"/>
</xsl:template>
```

Correct:

```xsl
<xsl:template name="render">
  <xsl:param name="width"/>
  <xsl:param name="height"/>
</xsl:template>
```

One name may be declared twice when both declarations carry a `use-when`
(XSLT 2.0 and later, or `_use-when` from 3.0) whose conditions leave only one
of them in the compiled stylesheet — the usual way to give one parameter a
different declaration per processor:

```xsl
<xsl:template name="render">
  <xsl:param name="size" as="xs:integer"
    use-when="system-property('xsl:version') = '3.0'"/>
  <xsl:param name="size"
    use-when="system-property('xsl:version') != '3.0'"/>
</xsl:template>
```

A parameter carrying no `use-when` is compiled wherever its sibling is, so a
sibling of the same name clashes with it whenever that sibling's condition
holds.
