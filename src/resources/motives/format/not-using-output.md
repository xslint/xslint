# Not using output

The default serialization method is *not* undefined — the spec fixes it to
`xml`, or to `html` when the root output element is `<html>`. So this is not
about avoiding implementation-defined behavior; it is about stating the
serialization intent explicitly and uniformly. A reader should not have to
infer the output method from the shape of the first element, and the choice
should be visible in one place. The only coherent policies are "every
stylesheet that serializes declares its output" or "none does", so xslint asks
for the first. What is asked to declare it is the stylesheet a transformation starts at:
one holding a template that matches the document root, or the template named
`xsl:initial-template`, that nothing else imports. A library of templates for
particular elements is imported into such a stylesheet and serializes as part
of it, so it is left alone.

Which stylesheet declares it is a question about the whole import tree and not
about one file. An `xsl:output` merges into every stylesheet that imports the
module holding it, so pushing the serialization into a shared module and
importing it declares the output for the tree as surely as writing it inline.
A tree serializes together, so a stylesheet is left alone when any tree
holding it declares one — the modules it imports, however deep the chain runs,
and the sheets importing it just as much, a library module being governed by
the main module that pulls it in. A named `xsl:output` does not count: it is
the format an `xsl:result-document` asks for by that name, and says nothing
about how the main result is serialized. A stylesheet is left alone too when it
imports a module it was not linted alongside, since an href leading out of the
linted set settles nothing either way and a file must not be judged on what
nobody handed us. An
`xsl:package` is left alone for that same reason: a package is *used* rather
than imported, and the stylesheet using it is where its serialization is
declared.

Incorrect:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <html><body><xsl:value-of select="."/></body></html>
  </xsl:template>
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html><body><xsl:value-of select="."/></body></html>
  </xsl:template>
</xsl:stylesheet>
```
