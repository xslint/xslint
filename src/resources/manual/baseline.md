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
the run names it and fails until the entry is dropped:

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

## Since a commit

A baseline matches a defect by the text of its line, so a change that edits a
recorded line sees its defects reported as new. `--since <ref>` judges a
change by git instead and needs no file:

```bash
xslint --since origin/master --max-warnings=0 src
```

The run lints the commit `<ref>` names in a scratch copy too, and maps each
line of the working tree to the line it was through `git diff`. A defect is
reported when the change added or edited its line, or when that line did not
draw the same check in the commit, as when a change deletes the last call to a
template another sheet declares. A renamed sheet keeps its old defects once
git sees the rename, and a file git does not track is new as a whole. A sheet
of a submodule, or of any repository nested in the tree, is left out of the
report, since that repository judges its own sheets.

Every path named must lie in one repository, and CI must fetch the commit:
with `actions/checkout`, set `fetch-depth: 0`. `--since` refuses to run with
`--baseline`, `--baseline-write`, `--baseline-prune`, or a fix flag, and
ignores the `baseline` key of `.xslint.yml`.
