# Adopting

The first run over a tree that grew for years without a linter draws hundreds
of reports. These steps take it from there to a build that fails on new
defects, and then pay the old ones down one pull request at a time.

## Measure

Count what the `recommended` preset finds, by check:

```bash
xslint --quiet --format json src | jq -r '.[].rule' | sort | uniq -c | sort -rn
```

A few checks usually carry most of the reports. Read their pages in the
[check catalog](../index.html) before deciding what to do with them. Run the
same command later to see how much is left.

## Turn off what you reject

A check the team disagrees with goes off in `.xslint.yml`. Nothing it finds is
reported again, new defects included:

```yaml
rules:
  template-writes-nothing: off
```

Keep this for checks you never mean to follow. A check you agree with but
cannot satisfy yet belongs in the baseline.

## Gate on a baseline

Record every remaining defect and commit the file, with the `.xslint.yml` if
you wrote one, since CI reads both:

```bash
xslint --baseline-write xslint-baseline.json src
git add xslint-baseline.json
```

Then run the gate in CI:

```bash
xslint --baseline xslint-baseline.json --max-warnings=0 src
```

The build now fails on any defect the file does not record, and on any
recorded one that is gone until its entry is dropped. Pass `--baseline` in CI
rather than naming the file in `.xslint.yml`, so a run on a developer's
machine still shows the whole debt. The [baseline guide](baseline.html) covers
how a defect is matched.

A recorded defect is matched by its file and the text of its line, so a pull
request that renames a sheet or edits a recorded line, in a feature as much as
in a fix, sees those defects reported as new. Fix them while you are there.
Otherwise read the list the gate prints: when every defect on it sits in the
renamed sheet or on the edited lines, record the tree again, and when any
other is there, it is new and needs fixing first:

```bash
xslint --baseline-write xslint-baseline.json src
```

Always record the whole tree, never one sheet, since a check that reads across
sheets finds different things in one sheet on its own.

## Pay it down

Take one check per pull request. List what it still finds, fix it, and drop
the entries the fix left stale:

```bash
xslint --only incorrect-use-of-boolean-constants src
xslint --only incorrect-use-of-boolean-constants --fix-suggestions src
xslint --baseline xslint-baseline.json --baseline-prune src
```

Commit the pruned file with the fix. A prune never records a defect, so the
count in the file only goes down. A fix that rewrites a line also loses the
entries other checks hold on it, and the prune lists them as new: check that
list and record the tree again, as above.

To turn on a check you turned off, delete its line from `rules:` and record
what it finds before the gate sees it:

```bash
xslint --only template-writes-nothing --baseline-write xslint-baseline.json src
```

A rewrite with `--only` replaces the entries of that one check and leaves the
rest of the file as it was.

## Move to the whole catalog

The `all` preset adds the rest of the catalog. Many checks a team rejects come
with it, and a check turned off after it is recorded keeps its entries in the
file for good. So set `preset: all` in `.xslint.yml`, then measure again and
turn off what you reject before anything else.

The preset also brings every fix `--fix` applies on its own, since those leave
a stylesheet meaning what it meant. Run `--fix` again until a run fixes
nothing, since one pass skips a fix that overlaps another, and commit the
stylesheets alone, so a reviewer reads a mechanical diff and nothing more.
Then record what the fixes left and commit it with the preset:

```bash
xslint --fix src
git add src
git commit -m "Apply the safe xslint fixes"
xslint --baseline-write xslint-baseline.json src
git add .xslint.yml xslint-baseline.json
```
