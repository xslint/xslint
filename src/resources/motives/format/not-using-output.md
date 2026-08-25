# Not using output

The default serialization method is *not* undefined — the spec fixes it to
`xml`, or to `html` when the root output element is `<html>`. So this is not
about avoiding implementation-defined behavior; it is about stating the
serialization intent explicitly and uniformly. A reader should not have to
infer the output method from the shape of the first element, and the choice
should be visible in one place. The only coherent policies are "every
stylesheet that serializes declares its output" or "none does", so xslint asks
for the first. A module with no templates — one imported into a pipeline that
sets the output itself — is exempt, since it never serializes on its own.

Which stylesheet declares it is a question about the whole import tree and not
about one file. An `xsl:output` merges into every stylesheet that imports the
module holding it, so pushing the serialization into a shared module and
importing it declares the output for the tree as surely as writing it inline.
A stylesheet whose imports reach one is therefore left alone, however deep the
chain runs. So is one importing a module it was not linted alongside, since an
href leading out of the linted set settles nothing either way and a file must
not be judged on what nobody handed us.

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
