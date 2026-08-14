# Unused function or template parameter

A parameter a function or template declares and never references is dead code,
and it costs more than the line it stands on. A caller has to be told what to
pass, so every `xsl:with-param` supplying it is dead too, and the next reader
has to work out whether the omission is deliberate. On an `xsl:function` it is
worse than clutter: the parameter is part of the signature, so the arity every
call site spells is carrying a value the body never reads.

A parameter is referenced when an XPath expression in the body names it —
a `select`, a `test`, a `match`, or the braces of an attribute value template
or a text value template. Nothing else counts, and three near-misses are worth
naming, because each is a parameter that reads as used and is not. Its name in
the output text of a literal result element is characters bound for the result
tree. Its name inside a string literal, `select="'$name'"`, is the same
characters an expression away. And its name inside an XML comment is a
reference somebody switched off, which is the strongest evidence there is that
the parameter is dead: a template whose body is commented out keeps only the
signature, and the signature is what every caller still pays for.

Incorrect:

```xsl
<xsl:template name="greet">
  <xsl:param name="name"/>
  <p>Hello</p>
</xsl:template>
```

Correct:

```xsl
<xsl:template name="greet">
  <xsl:param name="name"/>
  <p><xsl:value-of select="concat('Hello, ', $name)"/></p>
</xsl:template>
```

Where the parameter really is unwanted, delete it and every `xsl:with-param`
that supplies it — leaving the callers behind turns the dead declaration into a
dead argument, which no processor reports either. Where it was meant to be read
and is not, the fault is usually a misspelling one character apart from a name
the body does reference.
