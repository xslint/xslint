# `scripts/` — module notes

What each script builds or judges. The commands that run them are in the root `CLAUDE.md`.

## `scripts/generate-docs.js`

Builds the `docs/` site from checks + motives.

## `scripts/generate-checks.js`

Builds `src/resources/checks.json` from the check YAML (`npx grunt checks`).

## `scripts/budget.js`

Judges what a corpus cost the nightly tier against the budget `corpora.yml` gives it, from both
sides: past the budget the run has slowed, and further than `SLACK` under it the budget has stopped
being a bar and wants re-cutting. The step calls it rather than comparing two numbers of its own,
since a ratchet nobody routes through is one an inline comparison replaces — which is what had
happened, the three budgets standing 9, 14 and 18 times their runs by #785. A reading of no seconds
at all is no reading, a whole-second clock being unable to measure a faster run, and an empty corpus
is the count check's defect to report rather than this one's. `test/budget.test.js` holds every
budget to both ends of what its corpus has read on the runner — above the dearest night, and quiet
on the cheapest, since a budget of four times a reading fires on everything below a quarter of it
and a budget wide enough to fire on a night that has already happened reddens a build on a tree
nobody has touched — and asserts that the step still calls the script; `test/budget.deep.test.js`
runs the file the way the shell does, since the exit code is the whole of what arms the gate and a
verdict returned to nobody leaves the tier as unable to fail as #785 found it.
