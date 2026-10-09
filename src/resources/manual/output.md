# Output

Defects are written to stdout; progress and diagnostic logs go to stderr, so
`xslint path/to/dir > report.txt` captures only the findings. Pass `--quiet` to
drop the informational log lines:

```bash
xslint --quiet
```

Output is colored only when it goes to an interactive terminal, so a redirected
or piped run stays plain text; setting the conventional `NO_COLOR` environment
variable turns coloring off everywhere.

## Machine-readable output

`--format` selects the output. `text` (the default) prints one line per
defect, naming its severity, file, line, column, message and check; `json` and
`sarif` print a single document to stdout — logs stay on stderr, so
the document is clean to pipe or redirect; `github` prints GitHub Actions
workflow commands:

```bash
xslint --format json path/to/dir     # a flat array of defects
xslint --format sarif path/to/dir    # a SARIF 2.1.0 log
xslint --format github path/to/dir   # ::warning/::error annotations for CI
```

Each entry of the `json` array names the check as `rule` and carries its
`severity`, its `message`, and the `file`, `line` and `column` the defect stands
at. A fixable one carries a `fix` beside them, holding that span's own `line`
and `column`, the `value` it replaces, the `replacement` it would write, and
whether it is a `suggestion`. Defects come out ordered by file, then line, then
column, then rule — so two runs over one tree emit the same document, and a
report committed today diffs against one taken tomorrow.

Inside a GitHub Action, `--format github` makes each defect an inline
annotation on the pull-request diff with no upload step — the lowest-friction
way to see findings on a review.

SARIF feeds GitHub code scanning, so xslint findings appear as annotations on
pull requests. Each rule in the log is a check that drew a result, described by
the check's own message and graded at the severity the run gives it:

```yaml
- run: xslint --format sarif . > xslint.sarif || true
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: xslint.sarif
```

The `|| true` keeps a findings exit code from failing the step before the
upload; the alerts still surface in code scanning. Run it from the repository
root so the reported paths stay repo-relative — a file outside the working
directory is named by its absolute path instead.
