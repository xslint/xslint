# Releasing

`xslint` is the **source** of the release cascade: releasing it also
updates and releases `xslint-lsp` and `xslint-action` automatically.

## How to release

First, in `CHANGELOG.md`, rename the `## Unreleased` heading to
`## <version> - <date>` (the release notes come from that section).

Then comment on any issue or pull request:

```text
@rultor release, tag=`0.0.12`
```

The backticks around the version are required — without them Rultor reads an
empty tag and refuses the release.

Rultor validates and tests, tags the commit, and the tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which:

1. runs the tests, stamps the version, and publishes `@maxonfjvipon/xslint`
   to npm over OIDC (no token);
2. cuts the GitHub release from the `CHANGELOG.md` section;
3. fires a `repository_dispatch` (`xslint-released`, carrying the version) to
   `xslint-lsp` and `xslint-action`.

Each downstream repo then bumps its pinned `@maxonfjvipon/xslint`, validates
against it, and cuts **its own** next patch release — its version, not
xslint's number. So one `@rultor release` here releases all three tools.

## Prerequisites

- `DISPATCH_TOKEN` — an organization secret, a PAT with `repo` + `workflow`
  scope, so the cross-repo dispatch fires and the downstream tag triggers its
  own release.
- Each downstream `master` ruleset grants the organization admin a bypass, so
  the automated bump can push to the protected branch.
