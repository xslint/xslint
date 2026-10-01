# Fixing

`--fix` applies the corrections that are deterministic and leave the stylesheet
meaning what it meant. `--fix-suggestions` applies those and the ones that
change behavior, remove code, or are one of several reasonable corrections,
which a plain `--fix` never touches. A correction needing real judgment — a
fresh name, a more specific path — stays report-only, and a run without either
flag reports how many defects each option would fix.

```bash
xslint --fix path/to/dir
xslint --fix-suggestions path/to/dir
```

Only the exact span that was flagged is rewritten — the rest of the file is
left byte-for-byte intact — and a fix is skipped rather than applied when the
source no longer matches what it expects. Where two corrections cover the same
piece of an expression — the redundant whitespace in `d[position()  =  1]` sits
inside the predicate that becomes `d[1]` — only the wider one is applied, and
the other is announced as skipped. Run `--fix` again to take care of whatever
the first run left.

Which corrections a check offers, in which of those two tiers, and why the
construct is worth correcting at all, is on that check's own page in the
[check catalog](../index.html).

An expression xslint cannot parse draws one defect, from the validator, and the
checks that read expressions say nothing further about it: a stylesheet whose
real fault is a missing bracket comes back with that fault and not with a page
of advice about text no processor accepts. A rule that matches the attribute
structurally rather than reading the expression can still report there, and is
never offered a correction. Fix the syntax and the rest of the feedback appears
on the next run.

Where the expression sits no longer decides whether you are told why. A bare
one — a `select`, a `test`, and the rest listed under
`invalid-xpath-expression` — a **pattern** such as `match`, and each expression
the braces of an attribute value template, a text value template or a shadow
attribute enclose are all parsed, and whichever of them is broken is reported as
malformed. The report points at the character the parser stopped on rather than
at the attribute holding it, so a fault buried in a long expression, or in the
second of two `{...}` on one line, names its own column.

Pass `--fix-dry-run` to see what would remain after fixing, without writing any
file:

```bash
xslint --fix-dry-run path/to/dir
```
