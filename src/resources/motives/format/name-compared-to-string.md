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
