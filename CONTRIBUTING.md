# Contributing

Thanks for considering a contribution to xslint. Fork the repository, make your
changes on a branch, and open a pull request against `master`. We review and
merge changes that keep the build green and respect the project's quality
standards, following these
[guidelines](https://www.yegor256.com/2014/04/15/github-guidelines.html).

## Before you open a pull request

Make sure the full build passes:

```bash
npm test
```

This runs the test suite and ESLint through Grunt. The rules a change answers
to are in [`AGENTS.md`](AGENTS.md), and the map of the code, with the reasons
behind those rules, in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Adding a linter rule

New per-file rules live in `src/resources/checks/xpath`, and cross-file rules in
`src/resources/checks/corpus`, each with a matching test pack under
`test/resources`. The validators in `src/resources/checks/validation` and the
formatting checks in `src/resources/checks/format` are fixed in code; their YAML
only tunes severity and message. Regenerate the documentation site with:

```bash
npx grunt docs
```

## Requirements

You need [Node.js](https://nodejs.org/en) and
[npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
installed.
