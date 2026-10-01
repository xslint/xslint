# Programmatic use

`xslint` is embeddable — editors, build tools, and the
[language server](https://github.com/xslint/xslint-lsp) import it instead of
shelling out. `lint` takes in-memory sources and returns the defects, touching
no files and never exiting:

```js
const {lint, fixed} = require('@maxonfjvipon/xslint')

const sources = [{file: 'sheet.xsl', content: '<xsl:stylesheet .../>'}]
const defects = lint(sources, {suppress: ['short-names']})
// each defect: {name, severity, message, file, line, pos, fix?}

// apply the fixable ones without writing to disk:
const {contents} = fixed(sources, defects)
```

`lint(sources, {suppress, overrides, only, preset})` runs the validators and
linters of a preset, `recommended` unless named, over the `{file, content}`
sources, honors inline `xslint-disable` directives, runs every check
`overrides` names beside the preset, and hands
the defects back in the order the reports print them — file, line, column, rule;
`fixed(sources, defects, suggestions)` returns the rewritten content per file.

`settingsOf(dir, flags)` reads the `.xslint.yml` nearest to `dir` the way the
command line does, `flags` taking `config`, `preset`, `only` and `suppress`
over it, and answers options to hand straight to `lint`, plus `excluded(path)`,
whether `exclude:` keeps the stylesheet at that absolute path out, `file`, the
absolute path of the configuration it read (undefined when none), `base`, the
directory its globs resolve against, and `problems`, one sentence per
unknown key, mistyped value or rule naming no check. It prints nothing, and
throws rather than answering a problem where the preset names no check list or
the file is not YAML at all, as the command line fails on both:

```js
const {lint, settingsOf} = require('@maxonfjvipon/xslint')

const settings = settingsOf('/path/to/project')
const defects = lint(
  sources.filter((source) => !settings.excluded(source.file)), settings,
)
```

`stylesheetsOf(paths, settings)` answers `{stylesheets, problems}`: the absolute
paths of the stylesheets a run over `paths` reads, found the way the command
line finds them — both suffixes, what `.gitignore` and `exclude:` keep out —
and one sentence per warning it prints on the way, logging nothing above the
debug level itself. A relative path resolves against the working directory of
the process, not against `settings.base`, so pass absolute ones.
`sourceOf(file, content)` answers the source `lint` takes for that content,
reading the parameter entities it declares and the hrefs it writes that no file
stands behind relative to `file`, so a buffer nobody saved lints as the file
would:

```js
const fs = require('fs')
const {lint, settingsOf, stylesheetsOf, sourceOf} = require('@maxonfjvipon/xslint')

const settings = settingsOf('/path/to/project')
const {stylesheets} = stylesheetsOf(['/path/to/project'], settings)
const defects = lint(
  stylesheets.map((file) => sourceOf(file, fs.readFileSync(file, 'utf-8'))),
  settings,
)
```
