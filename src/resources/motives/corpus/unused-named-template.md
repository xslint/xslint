# Unused named template

A named template that is never invoked via `xsl:call-template` is dead code
and should be removed.

This is a cross-file check: it looks at every stylesheet linted together, so
a template invoked from another file (via `xsl:import` or `xsl:include`) is
not reported. The template is flagged only when no file calls it. Lint the
whole project at once so the check can see every caller.

A call only counts where something runs it. A template calling itself, or
two calling each other and nothing else, never starts, and neither does one
called only from a template that is itself dead — so each of them is reported,
the way an unreachable function is. What a run enters is a template with a
`match`, or a named one a caller outside every named template reaches.

A caller may spell the name as a shadow attribute — `_name="{'footer'}"`,
the form XSLT 3.0 allows for any attribute of its own elements — and that
counts as a call. Where one of them names a template only a run can work out,
any template in the project could be the one it calls, so nothing here is
called dead and the check stays quiet over all of them until that name is
readable where it stands.

A template named `initial-template` in the XSLT namespace is the entry point
XSLT 3.0 defines, invoked by the processor rather than by any
`xsl:call-template`, so no stylesheet ever names it and it is left alone. The
same holds of any template a run enters directly, such as one Saxon is given
with `-it:`, but a name chosen on a command line is not something a stylesheet
records, so those are reported and there is nothing here that could know
otherwise. It is the local part of the name that settles the exemption, so a
template called `initial-template` under any prefix is left alone — one of
your own, in a namespace of your own and never called, goes unreported. Name
your own templates something else and the check answers for them.

Incorrect:

```xsl
<xsl:template name="footer">
  <footer>Copyright 2026</footer>
</xsl:template>
<!-- xsl:call-template name="footer" never appears in this stylesheet -->
```

Correct:

```xsl
<xsl:template name="footer">
  <footer>Copyright 2026</footer>
</xsl:template>

<xsl:template match="/">
  <xsl:call-template name="footer"/>
</xsl:template>
```
