# Inline suppression

Silence a rule in one place with an XML-comment directive. Rule names are
optional and space-separated; with none, every rule at that location is
suppressed.

```xml
<!-- xslint-disable-next-line short-names -->
<xsl:variable name="x" select="1"/>

<!-- xslint-disable-file not-using-schema-types -->
```

- **`xslint-disable-next-line [rules]`** — the line after the comment.
- **`xslint-disable-line [rules]`** — the comment's own line.
- **`xslint-disable-file [rules]`** — the whole file (put it near the top).

A directive that suppresses nothing is reported as unused, so stale ones can be
found and removed. A run narrowed by its preset, `--only` or `--suppress` judges
only the directives whose rules it ran, since a rule it skipped reports nothing for a
directive to cover.

An expression written across several lines is one value, and a directive that
reaches any line of it silences every defect in it. Nothing inside a start tag
can carry a comment of its own, so a directive above the element is the only
way to reach a wrapped `@test` or `@select` at all — the cost is that it cannot
pick out one defect in such a value and leave its neighbours reported.
