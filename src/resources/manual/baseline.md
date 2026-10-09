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
of that file. An editor reads the same file through `settingsOf` and splits its
defects through `baselined`, both in the [API guide](api.html).

A defect is recorded by its file and its check alone. Neither its line number
nor its text is kept, so a line moved, reindented, or edited still matches.
The file is JSON sorted by key, and each path in it is relative to the
baseline's own directory, so it can be committed and diffed:

```json
{
  "src/main.xsl": {
    "short-names": 2
  }
}
```

A count is how many times that check fires in that file. A file that draws a
check more often than recorded reports every defect of that check in it, since
a count cannot say which one is new. Fixing one defect and adding another of
the same check in the same file nets zero and passes.

A count belongs to a path, so a renamed or moved sheet reports all its defects
as new, and its old entries stay in the file. Once the gate lists nothing but
the renamed sheet's defects, record the tree again in the same change:

```bash
xslint --baseline-write xslint-baseline.json src
```

The rewrite counts the sheet under its new path and drops the entries of the
path that no longer exists.

A baseline written by an earlier xslint, with line hashes where the counts
stand, is refused. Delete it and record it again with `--baseline-write`.

The baseline only shrinks. When a recorded defect is fixed, its entry is stale:
the run reports it as an error of the baseline file, at the line that records
it and under the name of its check, in whatever `--format` asks for, and fails
until the entry is dropped:

```bash
xslint --baseline xslint-baseline.json --baseline-prune
```

`--baseline-prune` lowers each count to what the run still draws and records
nothing new, so it reports the new defects as any other run does. Recording
them takes `--baseline-write`, which suits a newly enabled check. A run judges
only the files it reads and the checks it runs, and a prune or a rewrite
replaces only those entries, so a run over one directory, or with `--only`,
leaves the rest of the file as it was. Both drop the entries of a sheet that
no longer exists and of a check xslint no longer has.

`--baseline-write` and `--baseline-prune` refuse to run with `--fix`,
`--fix-suggestions`, or `--fix-dry-run`, since they would judge lines the fix
rewrites. Under `--baseline`, a fix run reports the new defects it left
unfixed and calls no entry stale for a defect it fixed; the next run without a
fix flag does.
