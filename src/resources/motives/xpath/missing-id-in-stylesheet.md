# Missing id in stylesheet

The `id` on the stylesheet root changes nothing about how a standalone
transform runs, but it tells one stylesheet from another in logs, error
messages, and tools that process several at once. The one policy a linter can
hold is that every stylesheet declares it, so declare it on each.

Incorrect:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <!-- stylesheet logic -->
</xsl:stylesheet>
```

Correct:

```xsl
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" id="stylesheet_name">
    <!-- stylesheet logic -->
</xsl:stylesheet>
```
