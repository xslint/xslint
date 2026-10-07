# Configuration

Project-wide settings live in a `.xslint.yml` file, discovered by walking up
from the current directory (or passed with `--config <path>`). Command-line
flags override the file, and the file overrides the built-in defaults.

```yaml
# .xslint.yml
preset: all              # default for --preset: recommended or all
rules:
  short-names: off       # turn one check off
  "unused-*": error      # or a family, by glob
exclude:
  - "test/**"                           # globs to skip, relative to this file
only:
  - "unused"                            # default for --only
max-warnings: 10                        # default for --max-warnings
log-level: info                         # default for --log-level
quiet: false                            # default for --quiet
baseline: xslint-baseline.json          # default for --baseline
```

- **`preset`** names the preset a run starts from, `recommended` unless it
  says `all`. Passing `--preset` replaces it.
- **`rules`** maps a check name — or a glob such as `unused-*` — to
  `off`, `warning`, or `error`. `off` disables the check (like `--suppress`);
  `warning` and `error` re-grade its severity. A check named exactly also runs
  where the preset leaves it out, which is how one style check joins a
  `recommended` run; a glob re-grades only the checks already in the run, so
  `"*": warning` or `"unused-*": error` adds none.
- **`exclude`** lists globs, relative to the config file's own directory, whose
  matching files are not linted. A pattern covering everything under a
  directory — `dir/**` — also stops the walk descending it, so an exclusion
  costs nothing rather than the walk it then throws away. A wildcard here reads
  a name opening with a dot like any other, so `dir/**` covers a
  `dir/.hidden/sheet.xsl` as much as the rest of what stands under `dir`.
- **`only`** lists the substrings `--only` would take, narrowing every run to
  the checks they name. Passing `--only` replaces this list rather than adding
  to it, and a check `rules` turns `off` stays off whichever of the two chose it.
  An entry no check name holds stops the run, naming that entry.
- **`max-warnings`**, **`log-level`**, and **`quiet`** set the defaults for the
  matching command-line flags.
- **`baseline`** names the [baseline](baseline.html) file a run compares
  against, relative to this file. Passing `--baseline` replaces it.

Unknown top-level keys, rule names that match no check, and values of the wrong
type (a non-numeric `max-warnings`, a non-list `exclude` or `only`, a
non-boolean `quiet`, a non-string `log-level`, `preset`, or `baseline`) are reported and
ignored, so typos do not pass silently. A preset that does not exist, or an
`only` entry no check name holds, fails the run instead, before a file is read,
since a run over the wrong checks would read as a clean report. An
`exclude` glob is named the same way when a run walks a directory and the glob
excludes nothing anywhere under it.
