# Baseline

A tree that has grown for years without a linter draws hundreds of defects on
its first run. A baseline records them once, so the build fails only on the
defects a change adds:

```bash
xslint --baseline-write xslint-baseline.json
git add xslint-baseline.json
xslint --baseline xslint-baseline.json --max-warnings=0
```

`--baseline-write <file>` records every defect the run finds and reports
none. `--baseline <file>`, or the `baseline` key of `.xslint.yml`, reports only
the defects the file does not record. A path given on the command line is read
against the working directory, and one in `.xslint.yml` against the directory
of that file.

A defect is recorded by its file, its check, and the text of the line it stands
on. Line numbers are left out, so a line moved by an edit above it still
matches.
The file is JSON sorted by key, and each path in it is relative to the
baseline's own directory, so it can be committed and diffed:

```json
{
  "src/main.xsl": {
    "short-names": {
      "4f1c0d2a9b7e3c55": 2
    }
  }
}
```

A count is how many times that line draws that check. A line that draws it
more often than recorded reports the extra ones.

The baseline only shrinks. When a recorded defect is fixed, its entry is stale:
the run names it and fails until the file is rewritten with
`--baseline-write`. A run judges only the files it reads and the checks it
runs, and a rewrite replaces only those entries, so a run over one directory,
or with `--only`, leaves the rest of the file as it was.

`--baseline-write` refuses to run with `--fix`, `--fix-suggestions`, or
`--fix-dry-run`, since it would record lines the fix rewrites. Under
`--baseline`, a fix run reports the new defects it left unfixed and calls no
entry stale for a defect it fixed; the next run without a fix flag does.
