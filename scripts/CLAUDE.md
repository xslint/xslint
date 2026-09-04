# `scripts/` — module notes

What each script builds or judges. The commands that run them are in the root `CLAUDE.md`.

## `scripts/generate-docs.js`

Builds the `docs/` site from checks + motives.

## `scripts/generate-checks.js`

Builds `src/resources/checks.json` from the check YAML (`npx grunt checks`).

## `scripts/audit.js`

Judges what `npm audit --json` read, which is three things and not two. npm exits `1` for an
advisory and for a registry answering 503 alike, so the nightly `audit` job reddened on both and
the issue it filed named neither. Two consecutive nights showed both: a real `qs` advisory reaching
us through `typed-rest-client`, and then the registry's own
`503 Service Unavailable` on a tree nobody had touched, which took the whole nightly red — the
thing #841 split this job out to avoid (#884). A report is told from what npm printed in its place by
the keys: `auditReportVersion` beside a `metadata.vulnerabilities` tally is a report, and a
`verdict` over one names every package and grade, worst first, `SHOWN` of them and then a count,
since a tally alone names nothing to act on. Otherwise it forks once more, and that third status
is the whole design rather than a nicety: npm names a fault of *its own* in `error.code` — an
`ENOLOCK`, a bad flag — and names none for a registry that did not answer, so the first reddens
and the second is `UNANSWERED`, which the step retries three times and then announces in the job
summary. Two statuses would have to choose, and either choice is a known disease — an outage
reddening the night is a red schedule nobody reads, and a *broken* audit forgiven is a tree that
goes unaudited every night while the job stays green, which is #645 one tier out. Whatever npm
printed that is no JSON at all reads as the third too, under the key an npm fault carries its
message in, since a crash says as much about the audit as a refusal does.

`test/audit.test.js` holds each verdict to the sentence it prints, over seven readings a real
`npm audit --json` wrote rather than any composed here — which keys npm chooses being the whole of
what this file stands on — and reads the step as data for the `node scripts/audit.js` it calls and
the `UNANSWERED` it tests, that status being the one number the shell and this file share. The
step's own retry count and pause stay the step's: a constant exported to be asserted against
itself is no gate. `test/audit.deep.test.js` runs the file the way the shell does, for `budget.js`'s
reason, and its `unusable` row is the load-bearing one — it pins that a refused npm reddens rather
than being forgiven with the outages.

## `scripts/budget.js`

Judges what a corpus cost the nightly tier against the budget `corpora.yml` gives it, from both
sides: past the budget the run has slowed, and further than `SLACK` under it the budget has stopped
being a bar and wants re-cutting. The step calls it rather than comparing two numbers of its own,
since a ratchet nobody routes through is one an inline comparison replaces — which is what had
happened, the three budgets standing 9, 14 and 18 times their runs by #785. Every number here is
milliseconds since #827, `TICK` naming the `date +%s%3N` the step times with: whole seconds put a
tick at half of what DITA-OT spends, so a reading was quantisation before it was a measurement and
the margin under the cheapest night was one tick of it. A reading of `0` is no reading still, an
empty corpus being the count check's defect to report rather than this one's. `test/budget.test.js`
holds every budget to both ends of what its corpus has read on the runner — above the dearest
night, and quiet on one `MARGIN` faster than the cheapest, since a budget of four times a reading
fires on everything below a quarter of it and a budget wide enough to fire on a night that has
already happened reddens a build on a tree nobody has touched — and asserts that the step still
calls the script and still times with the clock a tick is written in; `test/budget.deep.test.js`
runs the file the way the shell does, since the exit code is the whole of what arms the gate and a
verdict returned to nobody leaves the tier as unable to fail as #785 found it.

## `scripts/snapshot.js`

Judges what linting a corpus *drew* against the report committed beside it, which is the same tier
one question over: the budget holds what a night cost and this holds what it found. `lined` renders
the JSON report as one line per defect — the file relative to the corpus root, the line, the
column, the check, and where a fix stands the tier and the replacement, since a fix that changes is
a behaviour change as much as a detection that does — and `verdict` says how the reading differs
from `test/resources/corpora/<name>.txt`, gains first and losses after, `SHOWN` of them and then a
count. `--write` regenerates the file, which is the whole of how a meant change is accepted. The
step calls it for `budget.js`'s reason and combines the two exits itself: under `set -e` the first
non-zero aborts the step, so a snapshot diff chained in front would take the budget's verdict with
it, and a command on the left of `||` is exempt — hence `judged=0` and two `|| judged=1` lines.
`test/snapshot.test.js` reads the workflow as data and holds every corpus the matrix names to a
committed snapshot and back, so neither a corpus without one nor a file nothing lints survives;
`test/snapshot.deep.test.js` runs the file the way the shell does, for the exit code, and the
`--write` path through it.
