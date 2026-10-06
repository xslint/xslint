# Adopting

The first run over a tree that grew for years without a linter draws hundreds
of reports. These steps take it from there to a build that fails only on new
defects, and then pay the old ones down one pull request at a time.

## Measure

Count what the `recommended` preset finds, by check:

```bash
xslint --quiet --format json src | jq -r '.[].rule' | sort | uniq -c | sort -rn
```

A few checks usually carry most of the reports. Read their pages in the
[check catalog](../index.html) before deciding what to do with them. Run the
same command later to see how much is left.

## Fix what is safe

`--fix` applies only the corrections that leave a stylesheet meaning what it
meant. Commit its output on its own, so a reviewer reads a mechanical diff and
nothing else:

```bash
xslint --fix src
git commit -am "Apply the safe xslint fixes"
```

`--fix-suggestions` can change behavior, so it belongs with the work below,
one check at a time.

## Turn off what you reject

A check the team disagrees with goes off in `.xslint.yml`. Nothing it finds is
reported again, new defects included:

```yaml
rules:
  short-names: off
```

Keep this for checks you never mean to follow. A check you agree with but
cannot satisfy yet belongs in the baseline.

## Gate on a baseline

Record every remaining defect and commit the file:

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

## Pay it down

Take one check per pull request. List what it still finds, fix it, and drop
the entries the fix left stale:

```bash
xslint --only incorrect-use-of-boolean-constants src
xslint --only incorrect-use-of-boolean-constants --fix-suggestions src
xslint --baseline xslint-baseline.json --baseline-prune src
```

A prune never records a defect, so the count in the file only goes down. To
turn on a check you turned off, remove it from `rules:` and record what it
finds before the gate sees it:

```bash
xslint --only short-names --baseline-write xslint-baseline.json src
```

A rewrite with `--only` replaces the entries of that one check and leaves the
rest of the file as it was. Moving to the `all` preset works the same way: set
`preset: all` in `.xslint.yml` and run `--baseline-write` once without
`--only`.
