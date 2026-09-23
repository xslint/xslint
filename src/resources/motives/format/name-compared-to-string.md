# Name compared to a string

Testing an element's identity by string-comparing its name is slower and more
fragile than a node test:

```xsl
<xsl:if test="name() = 'xsl:message'">            →  <xsl:if test="self::xsl:message">
<xsl:apply-templates select="*[local-name() = 'label']"/>
                                                  →  <xsl:apply-templates select="*[self::*:label]"/>
```

`name() = 'xsl:message'` compares the lexical QName, so it silently depends on
the prefix the source happens to use and breaks under a different but
equivalent namespace binding; `self::xsl:message` matches by expanded name.
`local-name() = 'x'` throws the namespace away, which XPath 2.0 writes as the
wildcard `self::*:x`. A node test also lets the engine match without building
and comparing strings.

An unprefixed name is the subtle case. For an element in a default namespace,
`name()` answers the bare local name, while an unprefixed `self::pubdate` asks
for the element in no namespace at all — so in a stylesheet processing DocBook 5,
`name() != 'pubdate'` is true where `not(self::pubdate)` is false. The wildcard
asks what the comparison asks, and an `xpath-default-namespace` puts the bare
step in the namespace it names:

```xsl
<xsl:if test="name() = 'pubdate'">                →  <xsl:if test="self::*:pubdate">
```

XSLT 1.0 has no wildcard for it, so there an unprefixed comparison stands as
written.

Either quote spells the same string and both classes of equality comparison ask
the same question, so `name() = 'div'`, `name() = "div"` and the value comparison
`name() eq "div"` are one construct, and `name() != 'div'` is `not(self::*:div)`.
The prefix in front of the call makes no difference either: `fn:name()` is the
standard function under whatever prefix a stylesheet binds to the XPath functions
namespace, while a `name()` of your own is another function and says nothing
about the context node.

An ordering comparison is a different question — `name() lt 'm'` asks where the
name sorts, which no node test expresses — and so is a comparison about another
node, `name(@a) = 'x'` speaking of the attribute rather than of the element a
`self::` step would match. In a 1.0 stylesheet a `local-name()` comparison has no
shorter equivalent at all, the `*:x` wildcard being XPath 2.0's, so there it
stands as written. Neither has a comparison with a string no name can be spelled
with: `name() = ''` asks whether the node has a name at all, which is a question
about text nodes and comments rather than about which element this is, and no
node test puts it at any version.

Where the comparison stands settles it as well, because a `self::` step asks
about an element and the context need not be one. The `self` axis selects
elements, so `self::as` is false for every attribute and every namespace node:
in `@*[name() != 'as']` the name asked for is an attribute's, and the node test
that looks like its equivalent excludes nothing at all — the attribute the
predicate meant to drop survives it along with the rest. XPath 2.0 asks that one
with a kind test, `@*[not(self::attribute(as))]`, and a 1.0 stylesheet has no
node test for it at all, so there the string comparison is the only way to put
the question.

The node test in front of the predicate answers that as much as the axis does.
A `processing-instruction()` stands on the child axis and yet selects no element,
while its nodes do have a name — `name()` of a processing instruction is its
target — so the two spellings part company outright:

```xsl
<xsl:copy-of select="processing-instruction()[name() = 'ditaot']"/>
<xsl:copy-of select="processing-instruction()[self::ditaot]"/>
```

The first copies the instruction it names and the second copies nothing, in any
document. XSLT 1.0 puts that question as `processing-instruction('ditaot')`. A
`comment()` and a `text()` have no name for either spelling to read, and a
`node()` reaches instructions and comments beside elements, so there too the
comparison and the node test answer differently. Only a step selecting elements
alone — by name, by a wildcard, or by the `element()` and `schema-element()`
kind tests — asks one question in two ways.

Brackets hang a predicate off whatever stands in front of them, which need not
be a step at all. In `(@one | @two)[name() = 'eff']` the context is an attribute
exactly as it is under `@*`, and the string comparison is again the only way to
ask. Where every arm selects elements — `(gee | aitch)[name() = 'jay']` — the
node test stands.

The context need not come from the expression at all. An `xsl:for-each`, an
`xsl:for-each-group`, an `xsl:iterate` and an `xsl:copy` with a `select` set it
for what they hold, a template's `match` sets it for its body, and a sort or a
grouping key is asked of what its instruction selects. Under
`xsl:for-each select="@*"` or `match="processing-instruction()"`, `name()` is
the name of an attribute or the target of an instruction, and no `self::` name
test stands in for it:

```xsl
<xsl:for-each select="@*">
  <xsl:if test="name(.) != 'disable-output-escaping'">
    <xsl:copy-of select="."/>
  </xsl:if>
</xsl:for-each>
```

Rewriting that test as `not(self::disable-output-escaping)` copies the very
attribute it meant to drop. The same holds where nothing says what the context
is — a named template, a function, a top-level variable — so the comparison
stands as written there too.
