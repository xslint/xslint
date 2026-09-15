# Name compared to a string

Testing an element's identity by string-comparing its name is slower and more
fragile than a node test:

```xsl
<xsl:if test="name() = 'div'">                    →  <xsl:if test="self::div">
<xsl:apply-templates select="*[local-name() = 'label']"/>
                                                  →  <xsl:apply-templates select="*[self::*:label]"/>
```

`name() = 'div'` compares the lexical QName, so it silently depends on the
prefix the source happens to use and breaks under a different but equivalent
namespace binding; `self::div` matches by expanded name. `local-name() = 'x'`
throws the namespace away, which XPath 2.0 writes as the wildcard `self::*:x`. A
node test also lets the engine match without building and comparing strings.

Either quote spells the same string and both classes of equality comparison ask
the same question, so `name() = 'div'`, `name() = "div"` and the value comparison
`name() eq "div"` are one construct, and `name() != 'div'` is `not(self::div)`.
The prefix in front of the call makes no difference either: `fn:name()` is the
standard function under whatever prefix a stylesheet binds to the XPath functions
namespace, while a `name()` of your own is another function and says nothing
about the context node.

An ordering comparison is a different question — `name() lt 'm'` asks where the
name sorts, which no node test expresses — and so is a comparison about another
node, `name(@a) = 'x'` speaking of the attribute rather than of the element a
`self::` step would match. In a 1.0 stylesheet a `local-name()` comparison has no
shorter equivalent at all, the `*:x` wildcard being XPath 2.0's.

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
