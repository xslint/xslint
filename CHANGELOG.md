# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries for releases before this file was introduced record their npm
publication date only; detailed notes begin with the Unreleased section.

## Unreleased

- Report a stale baseline entry through the chosen format. A run that found
  a recorded defect gone failed with exit code 1 but wrote the entry only as
  a log line on stderr, so `--format github` drew no annotation, SARIF and
  JSON held no result, and the summary read "No defects found". Each stale
  entry is now an error of the baseline file, at the line that records it,
  under the name of its check (#1209).
- Describe each SARIF rule by its check. The rule took its description and
  level from the first defect of its name, so a check that drew only a stale
  baseline entry got that entry's message as its description and `error` as
  its level, whatever the configuration graded it. A rule now carries the
  check's own message and the severity the run gives the check, and
  `malformed-stylesheet`, which words a syntax fault and an undeclared prefix
  apart, is described by one summary covering both (#1214).

## 0.7.0 - 2026-10-08

- Add a baseline. A tree that grew for years without a linter draws hundreds
  of reports on its first run, and the only gate it had was `--max-warnings`,
  which counts reports without knowing which ones it counts, so a fixed warning
  paid for a new one. `--baseline-write <file>` records every defect the run
  finds and reports none, and `--baseline <file>`, or `baseline:` in
  `.xslint.yml`, reports only the defects the file does not record. The file
  counts defects per file per check, so a line moved or edited still matches,
  and a file that draws a check more often than recorded reports every defect
  of that check in it. A recorded defect the run no longer draws fails the run
  until `--baseline-prune` lowers its count, and a prune records nothing new,
  so the baseline only shrinks. A run judges and rewrites only the files it
  read and the checks it ran, and neither `--baseline-write` nor
  `--baseline-prune` runs with a fix flag (#1188, #1197).
- Add an adoption guide to the manual. The README explained each flag on its
  own, and nothing put them in order for a team whose first run draws hundreds
  of reports. The guide counts the reports by check, turns off the checks the
  team rejects, records the rest in a baseline that CI gates on, pays the debt
  down one check per pull request, and moves the tree to `preset: all` (#1189).
- Split each `--only` and `--suppress` value on commas. `--only=a,b` took the
  whole value as one substring that no check name holds, so the run checked
  nothing and still reported "No defects found"; a list now means the same as
  repeating the flag. A substring in either flag, or in `only:`, that no check
  name holds now stops the run with an error naming it and exit code 1, where
  it used to warn and lint on. So does an empty `--only` piece a stray comma
  leaves, which used to widen the run to the whole catalog (#1161).
- Stop installing `patch-package` with xslint. It was a runtime dependency
  run from `postinstall`, so every `npm i @maxonfjvipon/xslint` fetched it and
  its tree and ran it to patch nothing, since the patches it applies never
  ship. It is now a dev dependency run from `prepare`, which an install from
  the registry never runs (#1150).
- Stop four recommended checks misjudging XSLT 3.0. `name-starts-with-numeric`
  reads the local part of a `Q{uri}local` name, so a digit in the URI no longer
  fires and `Q{}9lives` does; `with-param-use-in-invalid-parent-node` admits
  `xsl:evaluate`; `duplicate-with-param-name` skips a parameter carrying a
  `use-when`, as `duplicate-param-name` does; and
  `missing-or-empty-name` asks a name of `xsl:element`, `xsl:attribute`,
  `xsl:processing-instruction`, and `xsl:namespace` too, where the last two may
  still leave it empty (#1199).
- Make the fix of `redundant-namespace-declarations` a suggestion, since a
  computed name or an extension function can resolve a prefix no scan sees.
  A declaration a literal result element copies into the output is reported
  with no fix at all, and an inline schema copies nothing. This check reads
  `exclude-result-prefixes` and `extension-element-prefixes` the way a
  processor does: below the root only from XSLT 2.0 on, and not at all past a
  3.0 shadow attribute. `leaking-result-namespace` reads
  `extension-element-prefixes` the same way, while it still takes the
  excluded prefixes from the root's own `exclude-result-prefixes`. So an
  extension instruction declared on a template copies nothing, and its prefix
  leaks from no literal element in its scope (#1174).
- Make `not-using-output` linear in the length of an import chain. It walked
  forward from every file and rescanned the whole edge list at each step, so
  a chain of imports cost the cube of its length. It now walks back once from
  the files that serialize or import outward, and forward once from what that
  reaches (#1141).
- Rewrite the README for a first visit. It opens with the `npx` command and a
  stylesheet the default preset reports three real faults in, and states what
  `recommended` draws over DocBook-XSL, TEI and DITA-OT. Usage, configuration,
  inline suppression, output, fixing, the stages and the API moved into a
  manual that the docs site renders, and each README section keeps a
  paragraph and a link to its page (#1095).
- State the principles xslint follows in the README: one way to say one
  thing, the processor of the declared version decides what is an error, a
  safe fix never changes the output, and advice stays inside the declared
  version. The motives of the consistency checks now open with the principle
  they serve, where `unabbreviated-axis` used to argue width (#1171).

## 0.6.0 - 2026-09-30

- Export `stylesheetsOf` and `sourceOf`, the discovery and the source building
  the command line ran inline. An editor calling `lint` walked the workspace
  its own way, so it read no `.xslt`, walked what `.gitignore` and `exclude:`
  keep out, and handed `lint` no parameter entities and no missing hrefs, so
  `broken-href` never fired there. `stylesheetsOf(paths, settings)` answers the
  stylesheets a run reads and the warnings it prints on the way as `problems`,
  and `sourceOf(file, content)` the record `lint` takes for content nobody
  saved, both through the one path the command line itself now runs.
  `settingsOf` also answers `file`, the configuration it read, and `base`, the
  directory its globs resolve against, so an editor no longer searches for
  `.xslint.yml` itself to know where to show its problems (#1136).

## 0.5.0 - 2026-09-30

- Export `settingsOf`, what a run over a project hands `lint`. The command
  line read `.xslint.yml` into `lint` options inline, so an editor calling
  `lint` read no configuration at all and, since the `recommended` default,
  could not get back the checks `preset: all` restores. `settingsOf(dir)`
  answers the `preset`, `only`, `suppress` and `overrides` the nearest
  `.xslint.yml` spells, `excluded(file)` for its `exclude:`, and the
  `problems` the file holds, printing nothing, through the one translation
  the command line itself now runs (#1128).

## 0.4.0 - 2026-09-29

- Name the file its caller spelled in `circular-import` and
  `redundant-import`. Both stamped the normalized path of the importing file
  on their defect, so `lint` over a source named `./a.xsl`, or any forward
  slash path on Windows, looked up no directives for it and threw a
  `TypeError` instead of handing back a report. The defect now names the file
  exactly as the source spells it, as `broken-href` already did (#1115).

- Judge an identity transform in `not-using-output`. Since #1031 the check
  judged a stylesheet nothing imports only when a template of it matched the
  document root or was `xsl:initial-template`, so a standalone identity
  transform, which the built-in rule enters through its `node()` template, went
  unjudged. A template in the default mode, in any of its spellings, taking any
  element, or the document element a `/name` pattern spells, now marks an entry
  point too. A stylesheet started with `-it` from another name stays unjudged,
  being indistinguishable from a library of named templates (#1046).

- Report only the `recommended` preset by default. A run used to report every
  check in the catalog, so the first run over a real project buried the few
  defects a processor refuses under thousands of style findings. The default
  now holds every check graded an error and the dead-code checks that proved
  almost never wrong over DocBook-XSL, TEI and DITA-OT, 245 reports where the
  whole catalog draws 11,161. `unused-variable` is not among them: its reports
  hold, but they ask for cleanup rather than name a bug, and they would be 234
  of the 479 the preset drew with them. `--preset all`, or `preset: all` in `.xslint.yml`,
  restores the whole catalog. `--only` still reaches any check, and a check
  `rules` names exactly joins the run, while a glob such as `"unused-*"`
  re-grades only the checks already in it. The `lint()` API defaults to
  `recommended` too, so a caller passing no `preset`, an editor integration
  among them, reports far less after upgrading; pass `preset: 'all'` to keep
  the whole catalog (#1094).

- Add the `undefined-variable` check (error): a `$name` no binding in scope
  declares is a static error every processor raises before it transforms
  anything. A global counts across the whole import tree, a local only from
  the sibling after its binding onward, and a text value template starts its
  scope at its own text node (#208).

- Resolve an entity whose replacement text names another. Each reference was
  replaced once, so DocBook's `&section.id;` reached the validator as
  `generate-id(&section;)` and the expression holding it was dropped unread.
  Declared values are now expanded until nothing is left to expand, and a name
  reaching itself stays an unresolved reference rather than a loop, as does one
  whose value would pass 65536 characters. A reference also stays standing
  once replacing it would grow one value past 65536 characters or one document
  past 2^20, so a billion laughs cannot exhaust memory however often a
  stylesheet references it (#1044).

- Report an unprefixed `name()` compared with a string in XSLT 1.0 again.
  `name-compared-to-string` withheld the whole report where the `*:name`
  wildcard it rewrites to cannot be spelled, so `name() = 'para'` went silent
  in every 1.0 stylesheet, sixteen DocBook-XSL rows among them. The report
  stands now with no fix, and a `local-name()` in 1.0 is still left alone.
  Its message no longer spells the `self::name` rewrite, which 1.0 gets
  right only where the source elements are in no namespace (#1042).
- Report an `xsl:import` or `xsl:include` whose `href` names no file. A
  processor refuses such a stylesheet with XTSE0165, and nothing said so until
  the transformation ran. The new `broken-href` error judges only a relative
  `href`, read against the file holding it; a URL, an absolute path, a
  `plugin:` URI, an `xml:base` in scope and a `use-when` that may drop the
  import are left alone. The command line reads the disk before linting, so
  `lint` stays pure and reports this only where its caller says which hrefs
  name no file (#209).

- Read the shadow where an XSLT element writes an attribute in both spellings.
  XSLT 3.0 ignores the plain attribute beside a shadow one, and Saxon writes
  `shadow` for `<xsl:value-of select="'plain'" _select="'shadow'"/>`, while
  xslint read the plain one: an invalid `select` beside a sound `_select` drew
  `invalid-xpath-expression`, a `use-when`, a version, an href or a type was
  taken from the ignored spelling, and the escaping fix deleted the plain
  attribute. The shadow outranks it everywhere now, below 3.0 too, where
  Saxon reads it as surely, and so does a text value template (#1114).

- Compare a shadowable attribute's value in both spellings. Five selectors
  compared `@name`, `@href` or `@test` in the plain spelling alone, so an XSLT
  3.0 stylesheet writing `_href=""` or `_test="'true'"` drew nothing, three of
  those being stylesheets Saxon refuses. Each asks `xslint:attribute` now and
  reads either spelling, a shadow whose value the run supplies counting as no
  value rather than an empty one, and the `incorrect-use-of-boolean-constants`
  fixer rewrites a shadow `_test` instead of crashing on it (#997).

- Report a malformed stylesheet where the parser stopped. `malformed-stylesheet`
  put every report at 1:1 and called a prefix nothing declares "not well-formed
  XML", so the 18 DocBook-XSL files using `xsl:` undeclared were told to fix
  their syntax at the first character. A report now stands where the parser
  gave up, which for those 18 files is the place xmllint gives, and a
  namespace fault draws a message of its own asking for the prefix to be
  declared (#1019).

## 0.3.0 - 2026-09-27

- Read the extension namespaces a simplified stylesheet declares.
  `leaking-result-namespace` read only the plain `extension-element-prefixes`,
  which on a literal result element root is a result attribute, so a prefix
  named in `xsl:extension-element-prefixes` was reported as leaking and a fix
  offered to exclude it, though Saxon leaves it out of the result. The root is
  now read in the XSLT namespace, as its excluded prefixes already were
  (#1086).

- Judge only what a transformation emits in `leaking-result-namespace`. The
  check took every element outside the XSLT namespace for a literal result
  element, top-level data such as DocBook's `doc:*` documentation among them, so
  a stylesheet emitting nothing under a prefix was told it leaked. On a
  simplified stylesheet it reported the XSLT prefix itself, which is never
  copied into a result, and its fix wrote a plain `exclude-result-prefixes`,
  which on a literal result element is one more output attribute rather than an
  instruction. Top-level data is now left out, the XSLT namespace is never
  reported under any prefix, and a simplified root is read and fixed through
  `xsl:exclude-result-prefixes` under whichever prefix it binds, or reported
  with no fix where it binds none (#1006, #1040, #1075).

- Anchor the root checks on `xsl:package` too. Four selectors named
  `xsl:stylesheet` and `xsl:transform` alone, so a package with no `id`, one
  holding too many templates, a nested root, or a template inside a template
  drew no report, though Saxon refuses the last two with XTSE0010. All four now
  name the third root, and `using-not-outermost-stylesheet` reports a package
  nested in any of the three as readily as a stylesheet (#1017).

- Report a parameter whose name starts with a digit, and a prefixed variable.
  `name-starts-with-numeric` read neither `xsl:param` nor the local part of a
  variable or template name, so `<xsl:param name="1top"/>` and
  `<xsl:variable name="my:3var"/>` went unreported while `my:4fun` was caught.
  Every declaration is now judged on its local part, and the check is graded
  `error`, since no processor loads a stylesheet holding such a name (#969).

- Remove `--stable`, the `stable:` key in `.xslint.yml`, and the `nursery:`
  mark it read. A check was to join the nursery by hand the day an issue
  reported it wrong, and nothing held the tree to that: four such issues are
  open and no check carries a mark, so `--stable` reported the same run as
  none. The flag is now an unknown option, the key an unknown key, and a check
  carrying a `nursery:` mark fails the build as `mature:` does (#1070).

- Count a prefix standing behind a minus sign as used.
  `redundant-namespace-declarations` scanned each value as text and refused a
  prefix with a name character in front of it, and `-` is one, so in
  `select="last()-tei:offset"` the declaration of `tei` was reported redundant
  and the safe fix deleted a binding the expression needs. Every expression is
  now read off the tokens of its parse, a string literal naming the prefix still
  counting, and only what no expression covers is read as text. A prefix named
  only inside an XPath comment `(: tei:x :)` no longer counts as a use, since a
  comment qualifies nothing (#1041).

- Offer `$name` in `confusing-variable-and-node` only where the variable is
  known to hold nodes. The fix was withheld only for a literal or one of twelve
  atomic calls, so a variable bound to `upper-case(title)`, `count(part) + 1` or
  `title/string()` was still offered, handing an atomic value to an instruction
  that selects nodes. The fix is now offered only for the few shapes that yield
  nodes: a step, a variable, a filter, union or path ending in one, and a call
  to `key`, `id`, `doc`, `document`, `root` or their kin. Every other binding
  keeps its report and loses the fix (#1043).

- Stop `empty-variable` advising removal, and leave a typed variable alone where
  no version is declared. The message told authors to remove the declaration,
  while in five of its seven corpus reports the variable is a top-level
  placeholder that other code reads or an importer overrides, so removing it
  turns every `$name` into a static error; it now asks for `select="''"` or some
  content. The `@as` exemption sat inside a `not()`, so a stylesheet declaring
  no version, or a malformed one, had its typed variables judged as 1.0 and
  reported; they now stay quiet, as every other version gate does
  (#1013, #1062).

- Match a function call by namespace URI and arity, and count one inside a text
  value template. `unused-function` compared the prefixed name a function was
  declared under, so `g:twice(1)` under another prefix bound to the same URI, or
  a braced `Q{urn:f}thrice(1)`, left the function reported dead, while a
  two-parameter `f:x` stayed alive on a one-argument call; a declaration named
  `Q{urn:f}double` could meet no call at all, in `unreachable-function` too. A
  call is now keyed by URI, local name and arity, `f:x#2` and the left side of
  an arrow `=>` counting, and `unused-function` and `unused-variable` read the
  braces of a 3.0 text value template as usages (#1008, #1073).

- Hold every check message to two sentences, the fault and then the remedy.
  Twenty-two of the sixty-nine messages broke that shape: four had no final
  period, seven ran past thirty words, eleven quoted a name as `'xsl:if'`, and
  two were ungrammatical. They are rewritten to fit, the long ones leaving their
  derivation to the motive, so a `--suppress` or `.xslint.yml` entry is
  unaffected, while a script matching the text of a message may need updating
  (#1072).

- Read braces only in the XSLT attributes the specification makes a template.
  Every attribute of an XSLT element holding no XPath had its braces read as an
  attribute value template, so `<xsl:param name="Q{}x"/>` and an `as` naming
  `Q{http://www.w3.org/2001/XMLSchema}integer` drew `invalid-xpath-expression`,
  though Saxon-HE compiles both. A plain attribute of an XSLT element now has
  its braces read only where XSLT declares it a template, such as the `name` of
  `xsl:element` or the keys of `xsl:sort`, while literal result elements and
  shadow attributes read them as before (#1067).

- Compare the names `duplicate-param-name` reads as expanded QNames, and excuse
  a pair a `use-when` may keep apart. The check compared `@name` as text,
  missing four pairs Saxon refuses with XTSE0580: `p:x` beside `q:x` under one
  URI, `x` beside `Q{}x`, a padded name, and a shadow `_name`. It also reported
  an `error` on two params a `use-when` keeps apart, which Saxon compiles. Names
  are now compared as the expanded QName either spelling holds, and a pair is
  excused where either param carries a `use-when` its version may read, the
  condition itself being left to the processor (#1060, #1066).

- Leave out what any literal false `use-when` removes, not only `false()`. A
  condition is judged by its effective boolean value, so `0`, `0.0`, `()`, `''`
  and `""` are as false as `false()` with nothing evaluated, and Saxon-HE drops
  the element for each, while xslint went on judging it and reported
  `empty-choose` as an `error` on every one. Those literals now prune as
  `false()` does, and a condition built from operators or calls, `not(true())`
  among them, is still the processor's to decide (#1057).

- Call a directive unused only where the run ran what it covers.
  `--only`, `--suppress` and a rule turned `off` skip checks, and a directive
  over one of them covered nothing and was reported unused, telling the author
  to delete the line that keeps the file quiet in a full run. A directive is
  now judged only when the run ran every check it names, or every check there
  is for one naming none (#1049).

- Leave out what `use-when="false()"` removes. Every check judged the
  stylesheet as written, so an element a processor never compiles drew
  defects of its own, as `empty-choose` did on an excluded `xsl:choose`, and
  a parent missing it was judged as if it held it, so a `choose` whose only
  `when` is excluded went unreported though Saxon refuses it. Such an element
  is now dropped with everything under it before any check runs, in the plain,
  namespaced and shadow spellings, wherever the version in force reads the
  attribute: 2.0 and later for the plain one, 3.0 and later for a shadow, so
  a 1.0 sheet is still judged whole. A condition other than the literal is left
  to the processor. Two reports follow from it: a disable directive inside a
  dropped element is now unused, and a declaration only dropped code refers to
  is now unused too (#1048).

- Read the entities an external parameter entity brings in. A stylesheet
  that takes its entity declarations from a file named by
  `<!ENTITY % name SYSTEM "file">`, as DocBook-XSL's index stylesheets take
  theirs from `../common/entities.ent`, had every expression using one of
  them skipped unchecked; the file is now read relative to the stylesheet, and
  where two declarations name one entity the first binds, as XML says. A
  defect in an attribute value an entity wrote into is placed where the file
  spells it and carries no fix, where it used to be walked past the reference
  onto the next line, and `--fix` rewrote whatever stood there (#1010).

- Report a named template only a loop of its own calls.
  `unused-named-template` counted any `xsl:call-template` as a use, so a
  template calling itself, or two calling each other and nothing else, went
  unreported though neither ever runs. The check now follows the call graph
  and reports those, and a template only such a loop calls. A template nothing
  calls is still reported alone, since a run may enter it with `-it:`, and what
  it calls counts as called (#1009).

- Judge only an entry point in `not-using-output`, and resolve DITA-OT's
  `plugin:` imports. The check reported every module of an import tree that
  declared no output, so a library linted alone, such as DocBook's
  `html/lists.xsl`, was reported though a run over the whole tree stays quiet,
  and a `plugin:<id>:<path>` import named no file, leaving 91 DITA-OT modules
  looking like nobody imports them. It now judges only a module nothing imports,
  one of whose templates matches the document root or is an
  `xsl:initial-template`, and reports it there; a `plugin:` URI resolves to
  `<id>/<path>` in the corpus, and a named `xsl:output` no longer counts as the
  output of the tree. The three corpora go from 19, 14 and 96 reports to 5, 3
  and 3 (#1004).

- Run only the checks named by `--only`, or by an `only:` list in
  `.xslint.yml`, matched by substring as `--suppress` is. A check the run
  suppresses or the config turns `off` stays off, and a name that also stands
  inside a longer one no longer lets the longer check through (#1030).

- Advise inlining an `xsl:attribute` only where a literal attribute says the
  same. `not-creating-attribute-correctly` asked nothing about what stood in
  front of the instruction, so where an `xsl:copy-of` or `xsl:call-template`
  ahead of it supplied the same attribute, the inline form it advised emitted
  the old value instead of the new one. It also advised inlining where the
  parent already carries that attribute, where a `separator`, `type` or
  `validation` is set, or where the value reads a variable declared beside it,
  which is out of scope on the start tag. Those are now left alone, only an
  `xsl:variable` or a static `xsl:attribute` of another name may stand in front,
  and a constant wrapped in `xsl:text` is reported as plain text is
  (#950, #965, #1005).

- Keep an absent node empty when advising the direct emptiness test.
  `string-length-compared-to-zero` rewrote `string-length(@x) = 0` as
  `@x = ''`, which is false where `@x` is missing while the original is true
  there, so the suggested fix silently inverted every template guarding a
  missing attribute. The empty direction now reads `string(@x) = ''` (or
  `eq ''` for a value comparison), exact on an absent node and on the first
  node XPath 1.0 measures; the non-empty `@x != ''` is unchanged (#1002).

- Grade dropping a pattern's leading `//` as safe only where it changes nothing.
  `starts-with-double-slash` offered a safe fix on every pattern outside
  `xsl:template`, but from 2.0 on a pattern opening with `//` matches only in a
  tree rooted at a document node, so dropping it widens an `xsl:number` count, a
  `group-starting-with` or an accumulator rule to parentless trees. The fix is
  now safe on an `xsl:key`, whose `key()` needs a document root anyway, and on a
  1.0 pattern outside `xsl:template`, and a suggestion everywhere else (#1015).

- Stop calling a nested `xsl:if` prohibited. `blank-nested-if` told each of its
  69 corpus reports that the construct is prohibited, which no XSLT version
  says. The message now calls it one condition stated in two places, and excepts
  an outer test guarding the inner one: from XPath 2.0 on, `and` may evaluate
  its operands in either order, so a `castable as` test joined to the cast it
  guards no longer guards it (#1016).

- Ask what XSLT sets as the context before advising a `self::` node test.
  `name-compared-to-string` read only the predicates inside an expression, so
  under `xsl:for-each select="@*"`, `match="@*"` or a processing-instruction
  match it offered `self::style` where `name()` is an attribute's name — the
  suggested rewrite copying the very attribute DocBook's `xtangle.xsl` drops.
  The check now climbs to the instruction or template setting the context and
  withholds the report where that is not an element or the root, or cannot be
  read at all. An unprefixed `name()` takes the `*:name` wildcard too, since
  an element in a default namespace answers its bare name where a bare
  `self::` step asks for no namespace; `xpath-default-namespace` keeps the
  bare step, and 1.0, which has no wildcard, leaves the comparison as it is
  (#1000).

- Report an `xsl:if` or `xsl:for-each` whose body holds only comments.
  `empty-content-in-instructions` required every child to be text, and a
  comment is a node that is not, so an instruction whose whole body was
  commented out went unreported though it writes nothing, a processor
  stripping comments from a stylesheet. Such a body now counts as empty, which
  adds seven reports over DocBook and DITA-OT (#1014).

- Read a namespace prefix where it qualifies a name, and where
  `xsl:namespace-alias` names it bare. `redundant-namespace-declarations`
  looked for the substring `prefix:` and counted `#all` as a use of every
  prefix, so its safe fix deleted the prefix a `stylesheet-prefix` names,
  and one used only inside a text value template, each leaving a stylesheet
  no processor compiles; while `tei:y` read as a use of `i`, and `#all`
  hid some 450 dead declarations across TEI. A prefix now counts only with
  no name character in front of it but an axis's `::`, so
  `ancestor::tei:div` still uses `tei`, text value templates are read off
  `expressionsOf`, both alias attributes are prefix lists, and `#all`, which
  names no prefix, is no use of any (#999).

- Offer a variable only where it is in scope and holds nodes.
  `confusing-variable-and-node` took every variable met earlier in the
  template, one declared inside an earlier `xsl:if` among them, read a bare
  name inside a predicate as if it stood where the variable was bound, and
  offered `$contrib` for a variable bound to `string(contrib)`, a type error
  under `xsl:apply-templates`. Scope is now the siblings in front of the
  instruction and of each of its ancestors, a name inside a predicate is
  left alone, and a variable bound to a literal, an atomising call or an
  atomic `as` is still reported but offered no fix (#1001).

- Leave a named `xsl:output` out of `output-method-xml`. A named output is only
  the format an `xsl:result-document` asks for, so a stylesheet writing an XML
  feed beside its HTML page was told to switch the feed to `method="html"`, and
  `--fix-suggestions` would have done so. An `xsl:output` carrying a `name`, in
  either spelling, is now skipped (#1003).

- Report a variable whose body is one `xsl:value-of` only where a `select` can
  say the same, and on parameters too. `setting-value-of-variable-incorrectly`
  never looked inside the instruction, so it advised a `select` for a `value-of`
  building its value from its content or carrying a `separator`, and it never
  read `xsl:param` or `xsl:with-param`. The inner `value-of` must now carry a
  `select` and no `separator`, in either spelling, and all three binding
  elements are read, so the corpora gain 269 reports, every one a parameter, and
  lose 28. The motive now advises `string(heading)` on 1.0 and
  `string-join(heading, ' ')` on 2.0 and later, where a bare `select` turns one
  string into a sequence (#1007).

- Stop `stylesheet-has-no-templates` advising deletion, and read an
  `xsl:package`. The message ended by offering to delete the file, while ten of
  its twelve corpus reports are empty modules that another stylesheet imports or
  includes as a customisation hook, where deleting one is a static error in its
  importer. It now asks only for a declaration, and an empty `xsl:package`,
  missed before, is reported too (#1012).

- Name a caller never reached, rather than a cycle, in `unreachable-function`.
  The message said every finding sat in a recursion cycle nobody enters, while
  six of the seven corpus findings hold no cycle at all: they are helpers called
  only from a function nothing calls. It now says the function is called only
  from functions that are never reached, and detection is unchanged (#1011).

- Withhold the fix of `using-disable-output-escaping` where deleting the
  attribute changes the output, and read its shadow spelling. The fix deleted
  the attribute, so an `xsl:text` holding `&lt;br/&gt;` emitted the escaped text
  where it emitted `<br/>` before, a change no parser or processor notices. The
  deletion is now offered only on an `xsl:text` whose content holds no `&`, `<`,
  `>` or brace, and never on an `xsl:value-of`, which leaves it on 3 of 112
  corpus reports. The check also reports `_disable-output-escaping="{'yes'}"`,
  the 3.0 shadow spelling it read past, which Saxon honours even at
  `version="1.0"` (#990, #992).

- Withhold `name-compared-to-string` where no node test replaces the comparison,
  and its fix where nothing binds the prefix. A 1.0 sheet was told to replace
  `local-name() = 'x'` with a node test XPath 1.0 cannot spell, the `*:x`
  wildcard being 2.0's, and `name() = ''` drew the same advice; neither is
  reported now, which withdraws 302 of the check's 498 corpus reports, none of
  them fixable. And `name() = 'ns:baz'` was offered `self::ns:baz` where nothing
  declares `ns`, a node test no processor compiles; the report stands there and
  the fix is withheld (#962, #991).

- Keep what the fix of `text-outside-xsl-text` writes a stylesheet a parser
  reads. It spelled its wrapper `xsl:text` whatever prefix the document binds,
  so TEI's `simple/mapatts.xsl`, which binds `XSL`, came back under an
  undeclared prefix; it spliced decoded text between the tags, so `&amp;` and
  `&lt;` came back bare; and it read an element holding text beside a CDATA
  section as one text node, so the run announced a fix and left the defect
  standing. The wrapper now takes the prefix the document binds, or is withheld
  where none is bound, the wrapped text is escaped, and an element holding a
  CDATA section among its text is reported with no fix (#976, #982, #993).

- Read an entity's replacement text as the markup it spells. The parser resolves
  no entity, so a declared entity's text went into the document as characters:
  DocBook-XSL's `&lf;`, an `xsl:text` holding a newline, drew nine reports as
  loose text, each offered a fix wrapping the ampersand in one more `xsl:text`,
  and an expression such an entity carried reached no check. The replacement is
  now parsed as markup where the reference stands, a reference whose declaration
  the run never read is dropped rather than reported as its own name, and a
  defect in what an entity brought is placed at the reference and offered no fix
  (#984).

- Decode a numeric character reference when applying a fix. The walk that
  verifies a fix against the source knew only the five entities XML predefines,
  so a span spelling `&#105;` or `&#x74;` failed it, and the run declined the
  fix, saying the source no longer matched after an edit nobody had made. Of the
  484 fixes over the three corpora that went that way, 462 apply now (#983).

- Escape a code-based check's replacement for the place it lands. A rewrite of
  an expression holding `&lt;`, `&amp;` or the quote delimiting its attribute
  spliced the decoded characters back as they stood, so
  `--fix --fix-suggestions` turned TEI's `omml2mml.xsl` and DocBook's
  `dbk2wp.xsl` into files no parser reads. A replacement is now re-encoded for
  the attribute delimiter or the text node it lands in, and left as it is inside
  a CDATA section (#957).

- Rename `select-starts-with-double-slash` to `scans-whole-document`, and report
  what an expression scans rather than where its slashes stand. The check read
  only a `select` whose text opened with `//`, so the `test` of an `xsl:when`,
  the `use` of an `xsl:key`, the braces of a literal result element and the
  second scan in `distinct-values((//o/@name, //o/@local))` went unreported,
  while a top-level `xsl:variable`, where the walk is paid once, was reported.
  Every `//` opening a path of its own is reported now, wherever it stands,
  except under a top-level binding or in a template matching `/` with no `name`
  or `mode`, each of which runs once per transformation. A `--suppress` or
  `.xslint.yml` entry naming the old check must name the new one (#958, #978).

- Write the bare path where `count-compared-to-zero` stands in a truth context
  on 1.0. The 1.0 fix wrote a `boolean()` call everywhere but a whole `@test`,
  so `count($node/preceding-sibling::sect1) > 0` inside an `or` became a wrapper
  that `redundant-boolean-call` reported on the next run, 49 of 172 fixes over
  DocBook-XSL. It now asks where an effective boolean value alone is taken, as
  `redundant-boolean-call` does, and writes the bare path there, keeping
  `boolean()` inside a predicate, where a number is a position (#977).

- Report only the `//` a pattern walks in `use-double-slash`. A `//` inside a
  predicate was charged as a step of the pattern's own path, so
  `match="nu[xi//omicron]"` drew advice to name a path the pattern had already
  named; it now draws nothing. A `//` opening a path inside the brackets, as in
  `item[//flag]`, walks the document once per candidate rather than widening the
  pattern, and is reported by `scans-whole-document` instead (#948, #970).

- Measure the local part of a name in `short-names`, and read `xsl:param` too.
  The function arm stripped the prefix while the variable and template arm
  measured the whole QName, so `my:k` was reported as a function and passed as a
  variable, and a parameter called `f` was never reported. One selector now
  measures the local part of every variable, parameter, template and function
  name, which adds 59 reports over the three corpora, each a one-character
  `xsl:param` (#964).

- Report a leading `//` in a `select` without offering `.//` in its place. The
  two name the same nodes only where the context is the document node, and there
  `.//` walks the same tree, so the fix was never both sound and worth applying:
  under Saxon a template matching `/object/metas` answers two nodes for `//o`
  and none for `.//o`. The report stays and the fix is gone (#949).

- Warn about an `exclude:` pattern that excluded nothing. A rule name matching
  no check drew a warning, while a glob matching no path was counted by nobody,
  so a directory renamed out from under a pattern read as a run still honouring
  it. A run that walked a directory now warns that the exclusion excluded
  nothing, a `dir/**` counting the directories it pruned as well as the files it
  dropped, and a run handed only files stays quiet (#951).

## 0.2.0 - 2026-09-17

- Walk no tree the project itself ignores. `allFilesFrom` opened every
  directory it was handed, so over `objectionary/eo` a checkout holding 123
  stylesheets was linted as 5,031 — the rest standing under fifty-two
  worktrees of one gitignored directory, with every tracked defect printed up
  to thirty-four times. The walk reads the `.gitignore` files it passes as it
  passes them, rather than asking `git check-ignore` per entry: a directory is
  asked before it is opened and a file only once its name says it is a
  stylesheet, so nothing under an ignored tree costs a rule match. The rules
  are not the whole of git's answer, though, and the index outranks them — a
  tracked path stays read however a line names it, where reading the lines
  alone dropped two of this checkout's own stylesheets and three of
  DocBook-XSL's, each of them named by the report the nightly diffs against. A
  `.git` met on the way down is a top of its own, with its own rules and its
  own index, an outer file's rules reaching no further into a nested project
  than git's do. `.git/info/exclude` and `core.excludesFile` are left to git on
  purpose, neither being the project's own statement about its tree, and a path
  named on the command line is read whatever any of them says (#929).

- Ask where a comparison stands before advising a `self::` node test in its
  place. The `self` axis selects elements and `name-compared-to-string` asked
  only what a predicate held, so `@*[name() != 'as']` drew
  `@*[not(self::as)]` — a predicate that excludes nothing at all, copying into
  the result the very attribute the stylesheet meant to drop, which Saxon 12.9
  confirms and which went out as a one-click suggestion. The axis is half the
  question: a `processing-instruction()` stands on the child axis and yet
  selects no element, a `comment()` and a `text()` have no name for either
  spelling to read, and brackets hang a predicate off no step at all. The check
  walks the parse to ask whether the context is provably an element, and what
  it withholds where the answer is no is the whole report rather than the fix
  alone, its message naming a rewrite it cannot make. Ninety-nine reports go
  across DocBook-XSL, TEI and DITA-OT, and the three snapshots are restated
  with them (#930).

- Spell the wildcard bucket key in the module that writes it. `src/tree.js`
  built the key of its every-element bucket out of a literal while
  `src/selectors.js` read that key back through a constant of its own, so one
  key had two spellings in two files with nothing holding them together:
  changing the constant reddened eight tests across the two suites that read
  it, and not one of them named the file that spelled the literal. The constant
  now lives where the key is written, and two selectors guard the halves — a
  template ending in a literal `*` is refused under `src/`, and so is a
  declarator initialised to a bare `*` anywhere but that one module, which is
  the half the first selector cannot reach (#893).

- Build `confusing-variable-and-node`'s scope out of the variables that bind a
  value, in either spelling XSLT gives the attribute. A declaration's `@name`
  was the whole of the test, so the identity-transform-and-merge idiom read as
  a mistyped reference — five sites in eo's parser — and the fix the check
  carries is where the damage stands: a variable bound by content holds a
  parentless tree of its own, whose nodes are members of no `node()` the source
  yields, so `node() except errors` subtracts the child element being replaced
  and the `node() except $errors` offered in its place subtracts nothing at
  all, SaxonJ-HE emitting the replaced element's text beside its replacement.
  The shadow spelling counts as a binding, and the two places that asked the
  question apart now ask it once (#922).

- Stop the walk at a directory an `exclude:` covers whole, rather than reading
  it and dropping what it held. `allFilesFrom` keeps a floor of its own now —
  nothing opens a `.git` or a `node_modules`, 92% of this checkout's own
  entries standing inside one — and takes a question a caller may add beside
  it. Only a pattern covering a directory outright prunes, a bare `dir`
  excluding no `dir/sheet.xsl`, so what a run reports cannot move and only what
  it pays to report it does. Nothing in a report tells a prune from a filter, a
  directory read and dropped saying precisely what one never opened says, so
  what pins it is a predicate recording what the walk asked and a directory
  made unreadable, which every run before this descended and died on (#923).

- Read both spellings of a stylesheet name. The discovery filter knew `.xsl`
  alone and it runs over the single-element list a named path becomes as
  readily as over a walk, so `xslint sheet.xslt` printed `Processed files: 0`
  and `No defects found` and left with a zero exit, where the same bytes named
  `.xsl` drew four defects — a path that does not exist at least earns a
  warning, and this one read as a clean file. One list answers it now, asked
  through one function, with a selector banning either suffix spelled into an
  `endsWith` or an equality anywhere in the repository: three sweeps over our
  own fixtures carried the literal and would have stepped over such a file
  exactly as discovery did. What that selector asks is whether a name *ends* in
  one of the two, never whether it spells one alone, a composite such as
  `.fixed.xsl` being how the third of them spelled it. A path given by name
  that matches neither earns a warning; a walk stays quiet, having been handed
  a directory rather than a request (#924).

- Report syntax a later version admits as what it is, rather than as malformed
  XPath. Text no version of XSLT admits and text a later one admits came back
  alike from the parse and were reported alike, as an expression that cannot be
  parsed and a fix that lies in its syntax — which is wrong three times over
  for the second kind. eo's `add-default-package.xsl` declares `version="2.0"`
  and writes a parenthesized pattern step XSLT 3.0 introduced, so Saxon-HE 12.5
  runs the file exactly as though it said 3.0 while Saxon 9.1.0.8, conformant to
  the version it promises, refuses the template at that offset: the expression
  is not malformed, the fix is not in the expression, and a user who goes
  looking for a typo concludes the tool is confused. The check's own motive had
  already conceded that the fix is sometimes the stylesheet's `version`.
  `syntax-newer-than-xslt-version` reports that kind now, told from the other by
  asking the grammar at each version above the one in force — which rests on the
  grammar being monotonic, measured over every shape the grammar sweep generates
  rather than assumed. The partition itself does not move, such an expression is
  still withheld from the linters, and the two checks suppress independently
  (#925).

- Anchor what a release writes, both halves of it having been wrong at 0.1.0.
  The version stamp replaced the string `0.0.0` wherever it stood, and
  `package.json` holds it three times: the version field, and two
  `@stryker-mutator/*` pins at `^10.0.0` that contain it. All three moved, so
  the published tarball named a stryker version nobody has released, and
  nothing failed — the stamp runs after `npm install`, and `npm publish`
  installs no devDependencies. The field is `npm version`'s to write now, that
  command knowing which key it owns, and the two substitutions left over
  `src/version.js` are held to reaching one place each — beside a third gate
  reading that module's own placeholders and holding each to exactly one
  stamp, so a substitution deleted or retooled cannot pass by leaving the
  other two nothing to weigh. The release notes were
  the other half: rultor publishes a release a minute before its build ends and
  writes the body again at the end, so the step bound to the tag push wrote the
  changelog and lost it — 0.0.12 and 0.1.0 carry rultor's commit log where
  0.0.13 and 0.0.14 carry the changelog, and no release has ever carried its
  own version as a title, `--title` having ridden the `create` fallback alone.
  A workflow on the `release` event, with `edited` among its types, asserts
  both again after the race, and only where rultor is the sender.

## 0.1.0 - 2026-09-09

- Introduce `--stable` by what it is for rather than by the size of the set it
  withholds. The second sentence a reader met was that the nursery holds no
  checks, so a flag with a real purpose read as scaffolding around a feature
  nobody finished — where an empty nursery is the tier working, and the count
  is the one part of that paragraph a build generates: the set held nine
  checks the morning of 2026-09-08 and none by the evening. What the prose
  never said is the reason to pass the flag at all, `--stable` being no
  shorter `--suppress`: the nursery is read off the checks themselves, so it
  grows the day an issue is filed against one and shrinks the day that issue
  closes, where the same names written into a user's own `.xslint.yml` go
  stale in both directions. The criterion is stated once now instead of twice,
  the count stands last, and the `.xslint.yml` precedence the paragraph
  restated is left to the section that states it in full (#914).

- Read the figures `README.md` states of this repository off the tree that
  answers them, rather than off a hand that restated them at a landing. Four
  numbers in one sentence stood between two-fold and twelve-fold understated —
  1,974 findings against the 10,488 the committed corpus reports hold, 22
  checks against 43, and 70 files against the 867 they name — while the one
  qualitative clause among them, *no false positives from its validators*,
  stayed true, which is the worst arrangement available: a reader who checks
  the one falsifiable claim finds it holds. Two more figures sat in the same
  blind spot, a count of the deep test files and a promise about how long the
  fast half takes, and both are gone rather than corrected, a figure nothing
  measures being prose. `npx grunt readme` writes the rest off the corpus
  reports and `checks.json`, and the suite refuses the file while they
  disagree (#896).

- Say what a Formatting check is rather than what one was. The README
  described the kind as reading each XPath expression as a stream of tokens
  and flagging redundant whitespace — one check out of the two dozen the
  directory holds, and the shape the rest were migrated off through Phase 4 of
  the parser work, so a reader who trusted the sentence went looking for the
  wrong thing. The kind is a check whose detection is written in code rather
  than as a declarative selector, its YAML tuning only `severity` and
  `message`. The enumeration is gone and the count is read off the tree
  (#780).

- Hold every coordinate this repository states of itself to the one its
  manifest declares — the npm name and the repository URL, each read by the
  one pattern out of the field that declares it and out of every tracked
  file, so a coordinate stated anywhere and the coordinate declared are the
  same string or the suite is red. Nothing but a reader had ever compared
  them, and the URI binding our own `xslint:` prefix still named the owner
  the move to the `xslint` organisation left behind, one owner out of date
  with the three fields beside it in the manifest. The scope stays the
  personal one, decided rather than defaulted into: what a rename buys is
  discoverability, and what it costs is a coordinate frozen across two
  published integrations and an action, a deprecated alias standing behind
  it, and a second name for a tool everything else already calls xslint
  (#337).

- Hold the two counts a `--stable` run turns on to `checks.json`, which three
  documents state and nothing read. The gate that counts a list a document
  names reached list constants alone and spelled numbers only as far as
  twenty-three, so the size of the nursery and of the tier beside it were
  prose: the release notes said fifty-four of them when this was filed, then
  fifty-seven, then fifty-nine, against a tree that reports sixty-eight — a
  live figure restated by hand at three landings and wrong after every one.
  `LENGTHS` derives both off one walk of the checks now, `checks` joins the
  nouns a claim may be spelled with, and the vocabulary reaches ninety-nine
  with `no` standing for the none an empty nursery has. Nursing one check
  reddens both documents that count it, and the entry that drifted states no
  live figure at all — a changelog records what a change did, where what a
  tier reports is a fact about the tree (#895).

- Read a version and a name through their shadow spelling, so an XSLT 3.0
  stylesheet writing `_version` is judged the way one writing `version` is.
  Any attribute of an XSLT element has that second spelling, whose value is an
  attribute value template a processor evaluates before the module compiles:
  four version gates read `@version` as text and one cross-file check read
  `@name` and `@href` the same way, so a sheet declaring `_version` cleared no
  floor and drew no report at all, and a shadow `@href` built no import edge.
  The version is one question now — `xslint:version(.)`, asked of the nearest
  declaration rather than spelled out per selector — and a static attribute
  value template is read wherever one may stand. A version no gate can place
  answers `NaN`, so no floor is cleared and the report goes unmade rather than
  guessed at, which is what `malformed-version-in-stylesheet`'s message and
  motive now say. The conformance gate turns forward with it: a selector may
  name a version attribute only where that attribute is the check's own
  subject, the two `*-version-in-stylesheet` checks, since every other one
  reads the version in force. Four checks leave the nursery and it holds
  nothing, which is the release bar and no claim that any check is finished —
  so the tier keeps its per-member code exercised through a nursery `lint`
  takes as an option, and says which check a glob graded it withholds anyway
  (#851).

- Read a cross-file reference off the **tokens** rather than the raw attribute
  text, which had four blind spots, two inventing a defect against working
  code and two withholding one. The scan found a fixed mark and took the run
  of name characters beside it, so whatever stood between the two was
  invisible: XPath lets a gap stand in front of the bracket a call opens, so
  `my:spaced (1)` called nothing the linter could see and the function was
  reported dead; a named function reference carries no bracket at all, so
  `my:pick#1` called nothing either; and a mark inside a string literal or a
  comment is a name no processor evaluates, so `concat('$quoted', 'x')` and
  `1 (: $commented :)` each kept a genuinely unused declaration alive. One
  lexing answers all four, and the `$` is asked before the bracket,
  `$pick(41)` being XPath 3.1's dynamic call on the variable rather than a
  call to a function of that name. A check names a **kind** of reference
  rather than a substring template — `reference: call` or
  `reference: variable` — `kinded` refusing a word this linter reads no kind
  for, since an index built for one holds no name at all and would report
  every declaration in the corpus dead. A value holding a brace is read twice,
  once whole and once for each expression its braces enclose, an attribute the
  usage selector chooses being an XPath expression or an attribute value
  template with nothing to tell which. Three checks leave the nursery, and the
  corpora gain one report: TEI's `$q`, named nowhere but inside the string
  literals of a `replace()` (#498).

- Judge a stylesheet embedded below the document element, which
  `missing-version-in-stylesheet` reached with neither of its arms. An
  embedded stylesheet (XSLT 1.0 §2.7) is a document of data holding a real
  module root, picked out by an `xml-stylesheet` instruction pointing at that
  element's `id`: one arm asks an XSLT root for a plain `version`, the other
  asks any other root for `xsl:version` unless it holds a module of its own —
  the exclusion #849 wrote so that an embedded document's outer root is not
  mistaken for a simplified stylesheet — so the outer root was correctly left
  alone and the embedded module was reached by nothing at all. A second arm
  reports it, anchored on a non-XSLT document element and so exactly
  complementary to that else branch; the anchor is what keeps a module nested
  inside another stylesheet to the one defect `using-not-outermost-stylesheet`
  already draws at `error`. Both spellings of the attribute are asked and all
  three XSLT roots named. The fixer needed no change, `missingVersion` forking
  on the namespace already. The check leaves the nursery (#705).

- Reach the pre-commit `rev:` in `README.md` from the `up` job, and bump the
  pin it left at `0.0.11` for three releases. That job rewrites the README on
  every tag, anchored on `xslint@[0-9.]+` — which the two npm coordinates carry
  and a bare `rev:` does not — so it rewrote two of the three version
  references and reported success each time, `sed` being silent about matching
  nothing and `create-pull-request` opening nothing where the tree is
  unchanged. Anyone copying the pre-commit block got the hook as it stood in
  July, 735 commits back. A second substitution reaches the line, and
  `test/workflows.test.js` now holds every version the README states of this
  repository to one value and to a pattern the job rewrites with, exempting on
  a table, red from both sides, the versions it states of somebody else
  (#897).

- Leave an `xsl:function` to `function-use-in-xslt-1` rather than reporting it
  a second time through its `@as`, which on a function is the attribute
  declaring the return type and on nothing else is optional. A 1.0 stylesheet
  defining one drew both checks at the one node, in contradiction of this
  check's own motive, which has said all along that the function is
  deliberately left out; the TEI corpus holds the case at `rdf/rdf.xsl:379`.
  The shadow spelling `_as` double-reported with it. That one line was the
  whole of what this check drew over DocBook-XSL, TEI and DITA-OT, so its
  `REFUSED` row leaves `test/snapshot.test.js` — the first time that gate has
  reddened from the side where an entry outlives what justified it rather than
  where a check starts stopping a build. The mark this check carries is
  rewritten to #851, whose defect in its version gate stands (#555).

- Narrow `setting-value-of-variable-incorrectly` to a variable carrying no
  `select`, so one that carries both a `select` and an `xsl:value-of` body
  draws one defect where it drew two. The advice was one nobody could follow:
  it asked for a `select` on a variable already holding one, while the same
  node drew the error saying the two may not stand together — XSLT forbidding
  the combination outright, 1.0 as an error and 2.0 and 3.0 as `XTSE0620`. The
  shadow spelling `_select` said it twice as well. The partition loses no
  report, a body of one `xsl:value-of` being content by any reading, so
  wherever this check went quiet the error still stands. The check leaves the
  nursery (#590).

- Withhold `using-namespace-axis` where the axis stands as a step of a `match`
  pattern, the advice it carries being one nobody can follow there: a pattern
  is matched by walking up from a node rather than evaluated, so neither
  `in-scope-prefixes()` nor `namespace-uri-for-prefix()` can stand where such
  a step does. A predicate of that same pattern holds an ordinary expression
  and is reported as it always was. The check leaves the nursery (#632).

- Narrow `mode-or-priority-without-match` to a template that carries a `name`,
  so one matchless template draws one defect where it drew two. A template
  with neither `match` nor `name` is `template-has-no-name-or-match`'s to
  report, and both faults are the same XTSE0500, so the pair said it twice and
  the advice pulled two ways at once — add a `match`, or drop the `mode`, over
  a template whose real fault is that nothing can reach it at all. Both checks
  leave the nursery (#550).

- Register `xslint:normalize-space` and spell it in the seven selectors that
  said `normalize-space`, which fontoxpath trims and collapses on
  JavaScript's `\s` rather than over the four characters of XML's `S`. Six
  checks read the wider gap, and read it in both directions: a no-break
  space, a line separator or an em space went unseen by
  `text-outside-xsl-text`, `variable-or-param-with-select-and-content` and
  `malformed-version-in-stylesheet`, and was mistaken for nothing at all by
  `blank-nested-if`, `empty-content-in-instructions` and
  `setting-value-of-variable-incorrectly`, which reported code a processor
  accepts. The seventh was already right, the shared walk serving it off a
  `normalized` of our own, so one tree held both answers to the same
  question. `text-outside-xsl-text` leaves the nursery (#881).

- Add `--stable` (and `stable:` in `.xslint.yml`), which withholds the
  *nursery* — the checks an open issue reports wrong about code a processor
  accepts. Each carries a `nursery:` mark naming that issue, so the tier is
  read off the checks themselves and grows as tickets close; grading a check
  verbatim in the config re-admits it, where a glob does not (#581).

- **Breaking:** rename `null-output-from-stylesheet` to
  `template-writes-nothing`, and ask it of every template rather than only a
  `/`-prefixed match, so `--suppress` strings and config `rules` keys change
  with it (#559).

- **Breaking:** rename `variable-or-param-without-name` to
  `missing-or-empty-name` and widen it to the XSLT elements that take an
  `@name`, an empty value counting as a missing one; add
  `missing-or-empty-href` beside it for an `xsl:import` or `xsl:include`
  written without one, which used to crash the run (#838, #597).

- Add the `modern-construct-in-xslt-1` check (error): a construct XSLT 2.0 or
  later introduced, standing in a stylesheet that declares `version="1.0"`,
  is something a 1.0 processor cannot run (#533, #532, #544).

- Add the `malformed-version-in-stylesheet` check (error): a `@version` that
  is not an `xs:decimal` used to disable every version gate in silence, so a
  `version="2"` stylesheet was judged as a versionless one. `2`, `2.0` and
  `2.00` are one version now, and a value nothing can place is reported
  rather than guessed at (#614).

- Add the fixable `redundant-boolean-call` check: a `boolean()` standing
  where nothing but a truth is taken drops its wrapper, so
  `test="boolean(@x)"` becomes `test="@x"`. An operand of a comparison keeps
  it, and so does a predicate, where XPath reads a number as a position
  rather than a truth (#370).

- Add the fixable `predicate-position-literal` check: a positional predicate
  written the long way is shortened, so `item[position() = 1]` becomes
  `item[1]` and `item[position() = last()]` becomes `item[last()]`, the XSLT
  2.0 value comparisons read the same way (#371).

- Judge XPath and patterns with a grammar of this project's own — the XPath
  3.1 expression productions and the restricted set a pattern admits, as
  recursive descent over the positioned lexer — rather than taking a verdict
  from fontoxpath at 3.1 whatever the stylesheet declares.
  `invalid-xpath-expression` answers at the version in force now, a `cast as`
  in a `version="1.0"` sheet included, and a malformed `match` or attribute
  value template is no longer silent. A round-trip proof and an acceptance
  diff against the engine gate it, over every expression this repository
  carries and 14112 nobody wrote, which is what turned up the lexer and
  grammar defects behind it (#677, #678, #679, #680, #732, #708, #731, #249,
  #617, #641, #676, #685, #703, #709, #711, #724, #726, #728, #736, #738,
  #740, #742, #746, #752, #753, #764).

- Report one defect per fault. An expression the XPath validator refuses
  reaches no check at all now, where ten linters used to rescan the corpus
  and report a second defect on the same text: `select="child::"` drew an
  `invalid-xpath-expression` and an `unabbreviated-axis` both, and the advice
  stood on text no processor accepts (#750, #636, #651, #586, #788).

- Read the version in force at the node under judgement rather than at the
  document root. `version` stands on any XSLT element and `xsl:version` on
  any literal result element, each setting the version of its own subtree, so
  a template raised or lowered against its root is judged as itself; a
  simplified stylesheet is read through its `xsl:version` rather than skipped
  by every version gate; and an embedded stylesheet's host root is no longer
  reported as a stylesheet missing one (#603, #608, #618, #702, #544).

- Read every expression a stylesheet carries, and only those. An attribute
  value template's braces, an XSLT 3.0 text value template, a shadow
  attribute (`_select` for `select`) and `xsl:use-when` in the XSLT namespace
  are validated and linted now, where 165 of 451 expressions used to reach
  nothing at all. A `test` or `select` that an attribute of a literal result
  element happens to spell is text bound for the result tree, so it is left
  alone rather than read as XPath and rewritten (#589, #579, #606, #849,
  #654, #647, #788, #556).

- Stop reading an element by the prefix one document chose. A stylesheet
  writing its XSLT as `XSL:` was read by no check that asked for `xsl:`, and
  a literal result element whose `xsl:` is bound elsewhere drew eight of them
  at once (#784).

- Withdraw the check-specific false positives: `not-using-output` where the
  `xsl:output` comes from an imported module (#548);
  `stylesheet-has-no-templates` on an import-only, output-only or overriding
  module (#494); `output-method-xml` on an XML document embedding an html
  fragment (#495); `sort-not-first` on an `xsl:with-param` standing before
  the `xsl:sort` (#487); `blank-nested-if` where the outer `xsl:if` holds
  text (#491); `name-starts-with-numeric` on an empty `@name` (#489);
  `using-disable-output-escaping` on a literal result element (#556);
  `use-node-set-extension` on any `*:node-set(` (#557);
  `redundant-namespace-declarations` on a prefix named only by an
  `exclude-result-prefixes`, and two columns to the right of a spaced
  declaration (#553, #681); `use-double-slash` on a union branch opening with
  `//` (#586); `using-namespace-axis` on a string literal (#497, #595); the
  two `count(*)` checks on whitespace an `xml:space="preserve"` keeps (#817);
  and the `count`/`string-length` comparisons on an arithmetic operand
  (#573).

- Stop grading `not-using-output` and `stylesheet-has-no-templates` as
  errors. An error stops a build, and neither of them faults anything a
  processor refuses: the spec fixes the default serialization method, and an
  empty module is a file somebody started. Both are warnings now, which is
  141 of the 167 error-graded defects the three corpora drew. Which checks
  may grade an error is held against those corpora rather than left to
  prose — the five that survive are the ones whose fault leaves the module
  unloadable (#499).

- Find the constructs a text scan missed: an `fn:`-prefixed call (#577,
  #596), the `eq`/`ne`/`lt` family XSLT 2.0 added (#763), a double-quoted
  string literal (#598), a call whose argument count makes the rewrite wrong
  (#576, #730), a `self::node()` and a whitespaced axis (#564), the `@use`,
  `@value`, `@group-by` and pattern attributes (#502), and every gap XML
  calls whitespace rather than the wider set JavaScript's `\s` matches (#643,
  #615, #639, #642).

- Accept the stylesheets every processor loads, and refuse what XML forbids.
  An entity whose name holds a dot and a file opening with a UTF-8 byte order
  mark are no longer `malformed-stylesheet` — which had left them linted by
  nothing at all — while a bare `&`, an unquoted attribute value and a `]]>`
  in character data are (#877, #574, #691).

- Stop `--fix` corrupting a stylesheet. Two fixes whose spans overlap cannot
  both be applied in one run: the left-most wins, the wider of two starting
  together wins, and the loser is announced and left in the report for a
  later run (#571). A comparison written with `&lt;` or `&gt;`, or shifted by
  an entity earlier in the same value, is located and fixed rather than
  skipped (#518, #525, #803); a CRLF line ending counts as one character
  (#626); a fix value is matched across a line wrap (#629); and five fix
  builders read an attribute's column and text off the source rather than
  inventing them (#718, #594, #611).

- Correct the fix tiers that changed behaviour. `count-compared-to-zero`
  emits the version-appropriate form — `exists()`/`empty()` on 2.0 and later,
  `boolean()`/`not()` on 1.0 — rather than XPath 2.0 functions a 1.0
  processor has never had (#485, #537); `string-length-compared-to-zero` no
  longer rewrites an emptiness test into one that differs when its subject is
  absent (#488); `starts-with-double-slash` withholds inside an
  `xsl:template`, where dropping the `//` shifts the rule's priority (#583);
  and `redundant-import` deletes only where deleting cannot move import
  precedence, on every spelling of an href rather than one (#667, #793).

- Stop the crashes and the silent losses. Walking a wide directory no longer
  throws a `RangeError`: the walk spread its findings into a `push`, whose
  arguments V8 caps at roughly 125 per kilobyte of stack, so this
  repository's own 768,731 files died before a byte of XSL was read (#758).
  The report is no longer truncated when stdout is a pipe, `process.exit`
  having ended the process where it stood and abandoned every write the
  kernel had not taken — 720 defects over twenty stylesheets arrived as
  65,492 of 165,500 bytes, with the exit code still right (#767, #822). And a
  defect built with one argument missing no longer reports at the wrong place
  (#601).

- Order the report deterministically — by file, then line, then column, then
  rule — so two runs over one tree emit the same document; and give the
  `json` reporter a `fix` object per fixable defect, holding that span's own
  line and column, the value it replaces, the replacement it would write, and
  whether it is a suggestion (#638).

- Make the run linear where it was quadratic. The cross-file linter tested
  every declaration against every usage and cost DocBook-XSL 44 seconds; it
  builds one index instead (#755, #783). Every internal `//` scan is served
  from one remembered walk of the document rather than a traversal per check
  (#635, #633, #784, #839, #811), `circular-import` walks the graph once
  rather than once per edge (#769), `unused-function-template-parameter`
  reads a body once rather than once per parameter (#776), and the version
  lookup remembers the ancestor chain it used to re-walk 950,645 times a run
  (#845).

- Answer in 72 ms where `--version`, `--help` and every rejected argument
  used to cost 137: the pipeline is imported inside the command action rather
  than at the top of the entry point, and the 68 check YAMLs are pre-rendered
  to one JSON a run requires (#687, #689).

- Measure speed, which nothing did while that quadratic reached master with
  eighteen jobs green. Every stage answers for its own share of a run's
  processor time at two corpus sizes on every pull request, and a nightly job
  times DocBook-XSL, TEI and DITA-OT at pinned commits against a budget
  judged from both sides — past it the run has slowed, far under it the
  budget has stopped being a bar (#756, #777, #785, #800, #827). Every defect
  the three corpora draw is committed and diffed too, so a check that changes
  what it reports, or what it would rewrite, says so (#638).

- Retire the `mature: true` freeze rather than leave a mark the tree could
  not back. Nine checks carried it, all nine were unfrozen, and the gate that
  was meant to hold them asserted nothing (#568, #588, #637, #865).

- Derive the `CHECKS` list that `--suppress` and the config `rules` keys
  match from the linters themselves, so a name cannot desync from the check
  it suppresses, and share one defect builder and one comparison scan across
  the code-based linters (#503, #500, #501).

- Enforce the conventions this project states. A source file stops at 1000
  lines and a JSDoc block at five lines of description (#748, #821, #825,
  #832, #844), a function leaves through one `return` (#623), no linter or
  validator imports another (#715), and a check selector may not test
  existence by counting, name an element by its prefix, or read one spelling
  of an attribute XSLT allows in two (#621, #784, #849).

- Fold twenty-two pack harnesses into one, so an assertion the packs carry is
  written once and every directory gets it — one of them asserted no fix at
  all while `redundant-import` attached a real deletion, the block written
  into the others never having reached it (#660, #607, #592, #506, #507).
  The xcop suite registers a pending fixture rather than skipping in silence
  when the tool is unreachable, reads each fixture's verdict out of one
  report rather than spending a ruby interpreter per assertion, and no longer
  loses every verdict behind the first file it refuses (#645, #693, #687,
  #505, #504).

- Fix the CI that could not report. The nightly and corpora `report-fail`
  jobs had no `issues: write` and so filed nothing (#826), `deps-sentinel`
  had no `pull-requests: write` and so commented nothing (#856), and `grunt
  mochacli` and `grunt eslint` ran a nested mocha 8 and eslint 9 beneath the
  12 and 10 `package.json` declares — where two of nine advisories lived
  (#841, #855). ESLint runs once rather than across the six-cell matrix, and
  before mocha rather than after it, where a failing test masked it (#509,
  #510, #511).

- Add the `redundant-double-negation` check: `not(not(x))` is a redundant
  double negation — exactly `boolean(x)`. Reported in any `@test`/`@select`,
  with a safe `--fix` that rewrites it to `boolean(x)` (always equivalent). An
  outer `not(...)` whose content is more than a lone inner `not(...)`, and a
  custom `my:not(...)`, are left alone (#366).

- Make the degenerate-`xsl:choose` checks disjoint, so each fires once with
  the right advice: `empty-choose` on no `xsl:when`, `use-single-option-for-
  choose` on exactly one `xsl:when` and no `xsl:otherwise` (use `xsl:if`), and
  `use-choose-without-otherwise` on two or more `xsl:when` and no
  `xsl:otherwise` (add one). Previously `use-single-option-for-choose` fired
  on any one-child `choose` — including a lone `xsl:otherwise`, where its
  advice was nonsense and it overlapped with `empty-choose` (#480).

- Add the `param-after-content` check: an `xsl:param` that follows real
  content in its `xsl:template` or `xsl:function` is invalid XSLT that XML
  well-formedness never catches (only other params and an `xsl:context-item`
  may precede it). Report-only, since moving the param up is structural
  (#367).

- Add the `sort-not-first` check: an `xsl:sort` that follows other content in
  its `xsl:for-each` or `xsl:apply-templates` is invalid and silently ignored
  by some processors. Report-only, since moving it to the front is structural
  (#372).

- Add the `empty-choose` check: an `xsl:choose` with no `xsl:when` is
  degenerate — XSLT requires at least one, and a `choose` holding only an
  `xsl:otherwise` is a wrapper that always runs. Report-only, since the fix
  (add a `when`, or drop the `choose`) is a judgement call (#374).

- Add the `otherwise-not-last` check: an `xsl:otherwise` followed by another
  branch is invalid — it is the default and must come last in its
  `xsl:choose`. Report-only, since reordering the branches is structural
  (#373).

- Add the `when-or-otherwise-outside-choose` check: an `xsl:when` or
  `xsl:otherwise` whose parent is not `xsl:choose` is invalid XSLT that XML
  well-formedness never catches. Report-only — wrapping the branch in an
  `xsl:choose` or rewriting an `xsl:when` as an `xsl:if` is a judgement call,
  not one mechanical edit (#368).

- Add the `redundant-import` check: the same module `xsl:import`ed or
  `xsl:include`d more than once within one stylesheet's own list is flagged (a
  warning) at the second and later references, with a safe `--fix` that deletes
  the duplicate line (the module stays imported by the first reference). Hrefs
  are resolved against the importing file's directory, so two spellings of the
  same file count as one, and the target need not be in the corpus — importing
  the same external library twice is redundant too. A self-import or cross-file
  cycle is a different fault, left to `circular-import` (#467).

- Add the `circular-import` check and an import-graph foundation
  (`src/import-graph.js`): resolve every `xsl:import`/`xsl:include` `@href`
  against the importing file's directory, build the dependency graph over the
  corpus, and flag each import that closes a cycle — a stylesheet that pulls in,
  directly or through a chain, one that pulls it back, or imports itself. A
  static XSLT error, reported as such. An href resolving outside the linted set
  is external and never part of a cycle, so a partial corpus cannot raise a
  false positive. First slice of the import-graph work (#210).

- Make `text-outside-xsl-text` fixable: `--fix-suggestions` wraps loose literal
  text inside an instruction in `xsl:text` (`<xsl:if test="a">hello</xsl:if>`
  becomes `<xsl:if test="a"><xsl:text>hello</xsl:text></xsl:if>`). A suggestion,
  and offered only when the instruction holds a single non-whitespace text node,
  since text on both sides of a child element needs several wraps that one edit
  cannot make (#459).

- Make `confusing-variable-and-node` fixable: `--fix-suggestions` prepends `$`
  to a bare variable name used as a node selector in an `xsl:apply-templates`
  `@select` (`select="items"` becomes `select="$items"`). A suggestion, since it
  assumes the author meant the variable rather than a child element (#458).

- Make `select-starts-with-double-slash` fixable: `--fix-suggestions` anchors
  the leading `//` of a `@select` as `.//` (`select="//title"` becomes
  `select=".//title"`). A suggestion, since it changes behaviour from an
  absolute scan to a relative one and `.//` is one of several valid anchors
  (a specific path is often better) (#457).

- Make `incorrect-use-of-boolean-constants` fixable: `--fix-suggestions`
  replaces the string test `'true'`/`'false'` with `true()`/`false()`. A
  suggestion, not a safe fix, because `'false'` is a non-empty string that is
  always true, so the rewrite changes the test's truth value — which is the
  bug it flags (#456).

- Make `starts-with-double-slash` fixable: `--fix` drops the redundant leading
  `//` of a template's `@match` (`match="//para"` becomes `match="para"`). It is
  a safe fix, not a suggestion, since a match pattern is already unanchored and
  the shortened pattern selects the same nodes (#455).

- Add the `leaking-result-namespace` check: a namespace prefix a stylesheet
  declares only for its own logic — `xs` for a sequence type, a helper `my`/`eo`
  called from a `select` — is copied into the serialized output by any literal
  result element, unless it is listed in `exclude-result-prefixes`. The check
  flags such a prefix, with a `--fix-suggestions` that adds it to
  `exclude-result-prefixes` (inserting the attribute or appending to it, and
  only when a single prefix leaks). It skips text-output stylesheets,
  `#all`/already-excluded and extension prefixes, and any prefix a result
  element genuinely uses, and complements `redundant-namespace-declarations`
  (a prefix used nowhere) rather than overlapping it, and catches the class of
  regression seen in objectionary/eo#6079 (#453).

- Add the `unreachable-function` check and narrow `unused-function` to suit.
  `unused-function` now flags only a function whose name appears in no call at
  all; a function that *is* called, but only from within a recursion cycle that
  nothing enters — a self-loop, or a `my:even`/`my:odd` pair — is dead code the
  new `unreachable-function` reports, following the call graph from calls that
  sit outside every function body. Previously such cycles slipped through, each
  reference propping the other up (#175).

- Add the `not-creating-attribute-correctly` check: an `xsl:attribute` with a
  static name on a literal result element, whose value is simple (a single
  `xsl:value-of`, text, or empty), can be written inline as a literal attribute
  (an AVT for a computed value). Warning only — the inline rewrite is structural
  and waits on the full-fidelity parser (#228). `xsl:element`/`xsl:copy` parents,
  computed names, and `xsl:choose` values are left alone (#438).

- Add the `translate-for-case` check: in an XSLT 2.0/3.0 stylesheet, a
  `translate(x, 'A..Z', 'a..z')` (or the reverse) that folds case over the ASCII
  alphabet is flagged, with a `--fix-suggestions` that rewrites it to
  `lower-case(x)` or `upper-case(x)`. A suggestion because those fold all of
  Unicode, not just ASCII. Fires only in 2.0/3.0, since 1.0 has no such
  function; any other `translate` is left alone (#440).

- Add the `name-compared-to-string` check: `name()`/`local-name()` compared with
  a string literal (either operand order) is prefix-fragile and slower than a
  node test. A `--fix-suggestions` rewrites `name() = 'x'` → `self::x`,
  `!= 'x'` → `not(self::x)`, and `local-name() = 'x'` → `self::*:x` (the
  wildcard, so 2.0/3.0 only); it is a suggestion because it shifts lexical-name
  to expanded-name matching. Only a comparison over the current node with a
  valid name is rewritten (#439).

- Add the `select-starts-with-double-slash` check: a `select` whose XPath begins
  with `//` scans the whole document from the root every time it runs — a real,
  repeated scan, unlike the merely redundant leading `//` in a match pattern.
  Warning only, since the right anchor (`.//` or a specific path) depends on
  intent. An inner `//`, one inside a string, or one reached through a variable
  is left alone (#435).

- Add the `string-length-compared-to-zero` check: `string-length(X)` compared
  with `0` to test emptiness (in either operand order, inside larger boolean
  expressions) is flagged, with a `--fix` that rewrites it to `X != ''` or
  `X = ''` when `X` is a simple operand. A genuine length check such as
  `string-length(X) > 1` is left alone, and a union argument is reported but
  left for a human. The lexer helpers `masked`/`closes` are extracted to
  `src/expressions.js`, shared by the count, node-set, and string-length
  linters (#437).

- Add the `count-compared-to-zero` check: `count(X)` compared with `0` to test
  existence (`> 0`, `= 0`, `!= 0`, `>= 1`, `<= 0`, `< 1`, in either operand
  order) is flagged, with a `--fix` that rewrites it to `exists(X)` or
  `empty(X)`. It works inside larger boolean expressions and leaves a genuine
  count such as `count(X) > 1` alone (#436).

## 0.0.14 - 2026-07-28

- Make the `starts-with-double-slash` and `use-double-slash` messages honest.
  They blamed a "document scan" that a match pattern never performs; they now
  say a leading `//` is redundant and an inner `//` matches at any depth,
  matching the motives corrected earlier (#423).

- Drop the `not-using-schema-types` check. It fired on a 2.0/3.0 stylesheet that
  used no `xs:` type anywhere — an arbitrary "use at least one type" rule that a
  single token type silenced and that flagged perfectly valid untyped
  stylesheets. A precise per-binding replacement is parked in #430 (#423).

- Refresh the real-code proof after the check audit: 1,974 findings across 22
  checks on the same 70 DocBook/TEI/DITA files (was 2,019 across 23), and bump
  the stale install-example version in the README (#423).

## 0.0.13 - 2026-07-28

- Drop the `unsorted-imports` check. Ordering `xsl:import` elements alphabetically
  can change import precedence — a later import overrides an earlier one on a
  template conflict — so advising that reorder risked changing behavior (#423).

- Rework the size and count checks into one coherent band, split by node type so
  they never double-report (#423):
  - `too-many-small-templates` → **`too-many-templates`**: fire when a stylesheet
    declares ten or more `xsl:template`, whatever their size, since a file with
    that many templates is hard to read (breaking: the `--suppress`/config name
    changes).
  - `function-template-complexity` → **`function-complexity`**: look only at
    `xsl:function` (more than 50 elements); a large template is a different smell
    (breaking rename).
  - `monolithic-design` → **`oversized-template`**: fire on a single
    `xsl:template` holding more than 100 XSLT elements, rather than on any
    one-template stylesheet — a small one-template sheet is fine, an undecomposed
    hundred-element one is not (breaking rename).

- Rewrite four check motives to argue their real rationale instead of a false
  one. `missing-id-in-stylesheet` and `not-using-output` are consistency rules,
  not technical necessities — an `id` does nothing on a standalone stylesheet,
  and the default output method is defined by the spec rather than left
  implementation-defined. `use-double-slash` and `starts-with-double-slash`
  are about over-broad, under-specific match patterns, not a "full document
  scan" that a match pattern never performs (#423).

## 0.0.12 - 2026-07-27

- Fix a family of false positives surfaced by linting real-world XSLT
  (DocBook-XSL, TEI, DITA-OT, and objectionary/eo):
  - `invalid-xpath-expression` no longer rejects XPath 1.0 numeric coercion
    such as `substring-before(...) - 1`, nor the `namespace::` axis (#396,
    #402).
  - `malformed-stylesheet` tolerates internal-subset entity declarations, and
    declared entities are resolved before linting (#395, #403).
  - `unused-function` and `unused-variable` now follow usage across the whole
    corpus, so a definition in a `_funcs.xsl`/`_specials.xsl` library used from
    an importing stylesheet is no longer flagged (#407).
  - `incorrect-use-of-boolean-constants` fires only on a bare boolean constant
    in an `xsl:if`/`xsl:when` test, not on string comparisons or output (#409).
  - `empty-content-in-instructions` leaves an empty `xsl:when`/`xsl:otherwise`
    alone; only `xsl:if`/`xsl:for-each` are flagged (#411).
  - `stylesheet-has-no-templates` and `not-using-output` exempt library modules
    that have no templates (#412, #414).
  - `null-output-from-stylesheet` no longer flags an empty node-suppressing
    template (#413).

- Add a `.pre-commit-hooks.yaml` so xslint can run as a pre-commit hook.

- Turn the documentation-site index into a landing page and add a "proven on
  real code" section.

## 0.0.11 - 2026-07-27

- Move the project to the `xslint` GitHub organization; the repository,
  homepage, and documentation-site URLs now point at `github.com/xslint`.

## 0.0.10 - 2026-07-26

- Expose a programmatic API: `lint(sources, {suppress, overrides})` returns the
  defects for in-memory `{file, content}` sources without reading files,
  printing, or exiting, and `fixed` applies the fixes. The package `main` now
  points at this API (the CLI bin stays `src/index.mjs`), so editors and the
  planned LSP server (#336) can embed xslint instead of shelling out. The CLI
  is now a thin wrapper over `lint` (#336).

- Add three more `--fix-suggestions`, each a `src/fixers.js` registry entry:
  `output-method-xml` (switch `method="xml"` to `"html"`),
  `missing-version-in-stylesheet` (declare `version="1.0"`), and
  `mode-or-priority-without-match` (delete the orphan attribute, when exactly
  one of `mode`/`priority` is present) (#334).

- Add a suggestion tier to `--fix`. A fix marked `suggestion` is opinionated —
  it changes behavior, removes code, or is one of several valid corrections —
  so `--fix` leaves it and only the new `--fix-suggestions` applies it. A
  declarative xpath rule can now carry a fix through `src/fixers.js` without
  becoming a code-based linter; `using-disable-output-escaping` is the first
  suggestion (the attribute is deleted). A run without `--fix` now reports how
  many defects each option would fix (#334).

- Make `use-node-set-extension` fixable by `--fix`: it is now a code-based
  check (`src/node-set-linter.js`) that reports one defect per `node-set()`
  call in a `@select` of an XSLT 2.0/3.0 stylesheet, with a fix that unwraps it
  (`exsl:node-set($x)` → `$x`). It masks string and comment spans before
  matching, so a `node-set(` inside a literal is never flagged (#334).

- Make `redundant-namespace-declarations` fixable by `--fix`: it is now a
  code-based check (`src/namespace-linter.js`) that reports one defect per
  namespace prefix declared on the stylesheet but used nowhere, positioned at
  the declaration, with a fix that deletes it. Detection is unchanged; the now
  unused `xslint:in-scope-prefixes` custom XPath function was removed (#334).

- Make `unabbreviated-axis` fixable by `--fix`: it is now a token-aware check
  (`src/xpath-axis-linter.js`) that reports one defect per verbose axis and
  abbreviates it (`child::x`→`x`, `attribute::x`→`@x`, `parent::node()`→`..`).
  It reads every XPath and pattern attribute, so an axis in a template `match`
  is caught, and points at each occurrence rather than the whole element; a
  `parent::` with any other node test, having no short form, is no longer
  flagged (#334).

- Add a `--fix` mode (`--fix-dry-run` to preview) that rewrites the
  mechanically-fixable defects in place. It covers `redundant-whitespace`
  today: a check-agnostic engine (`src/fixer.js`) applies the `fix` a defect
  carries only when the flagged span still matches, leaving the rest of the
  file byte-for-byte intact (#334).

- Add a scheduled workflow that keeps the `xslint-action` version in the README
  current, opening a PR when the action publishes a new release (#357).

- Enforce a 100-character line length for Markdown (code blocks and tables
  exempt); `CLAUDE.md`, a dense one-line-per-paragraph reference, is exempt
  (#355).

## 0.0.9 - 2026-07-24

- Fix the release workflow: read the changelog for the GitHub Release notes and
  set them with `gh release edit` (falling back to create) rather than failing
  on Rultor's existing release, and stop pushing the changelog to the protected
  `master` — the changelog is now promoted in the pre-tag pull request (#349).

## 0.0.8 - 2026-07-24

- Declare `repository` (so `npm publish --provenance` validates) and a
  `files` allowlist that ships only `src`, keeping `coverage`, tests, and the
  dev-only `patches` out of the published package (#346).

- Publish releases from a GitHub Actions workflow via npm OIDC trusted
  publishing (no token to rotate, with provenance), promoting the changelog and
  cutting a GitHub Release; `@rultor release` still validates, tests, and pushes
  the tag that triggers it (#343).

- Authenticate Codecov uploads with `CODECOV_TOKEN`, so coverage reports upload
  and the badge reflects real coverage (#341).

- Add a `--format github` reporter that prints GitHub Actions workflow
  commands, so findings render as inline annotations on the pull-request diff
  with no SARIF-upload step (#333).

- Evaluate suppression once per run in the per-file XPath linter instead of
  re-checking it for every file, matching the other linters (#331).

- Run the coverage gate in Rultor's merge and release builds, so a drop below
  100% blocks the merge and the release rather than only annotating the pull
  request (#328).

- Type the `TOKENS` map with a non-drifting index signature instead of a
  hand-maintained key-by-key literal that had fallen out of sync (#327).

- Count every `src` file toward the 100% coverage gate (`c8` `all`), so a module
  shipped without a test now fails CI instead of being silently omitted (#322).

- Extend the `node:`-prefix ban from `require` to ESM `import` as well, and use
  bare specifiers in `eslint.config.mjs` (#319).

- Name an out-of-tree file by its absolute path in `json`/`sarif` output rather
  than a `..`-climbing relative path that GitHub code scanning cannot map
  (#320).

- Parse the corpus checks once at module load instead of on every run, matching
  the other linters and validators (#317).

- Send a fatal CLI error's stack trace to stderr instead of stdout, so stdout
  stays clean for defects and machine-readable output (#318).

- Reach 100% statement, branch, function, and line coverage and raise the
  gate from 90% to 100% (the CLI bootstrap `src/index.mjs` is excluded, as it
  already is from mutation testing) (#305).
- Add a project-local ESLint rule that bans a redundant return variable
  (`const x = expr; return x`), so the convention is enforced on new code
  (#310).
- Load the CLI entry as an ES module (`src/index.mjs`) so `commander` — which
  is ESM-only — no longer triggers Node's `ExperimentalWarning` on every run;
  the test harness no longer silences warnings, so it sees what users see
  (#300).
- Report a stylesheet as malformed for any well-formedness problem the XML
  parser reports, not only the fatal ones — an undefined entity or a stray
  `<` no longer slips through — and route the parser's own diagnostics through
  the logger instead of leaking them to the console (#298).
- Assert behavior rather than whole-corpus totals in the end-to-end tests, so
  adding a fixture or a rule no longer breaks an unrelated test (#303).
- Use bare module names in `require` (drop the `node:` prefix) and enforce it
  with an ESLint rule; collapse the duplicate `warn`/`warning` naming in the
  logger and writer (#304).
- Apply `--log-level`/`--quiet` before reading the configuration, rule
  patterns, and suppressions, so a raised level now silences their warnings
  too (#299).
- Color output only for an interactive terminal and honor `NO_COLOR`, so
  redirected or piped output no longer carries raw ANSI escapes (#302).
- Report and ignore `.xslint.yml` values of the wrong type — a non-numeric
  `max-warnings` no longer silently disables the warning gate (#301).
- Add machine-readable output: `--format json` and `--format sarif` (SARIF
  2.1.0, for GitHub code scanning) alongside the default `text` (#260).
- Add inline suppression directives — `xslint-disable-next-line`,
  `xslint-disable-line`, and `xslint-disable-file` (#262), and report a
  directive that suppresses nothing as unused (#288).
- **Breaking:** drop the `template-match-` prefix from every rule name and
  rationalize a few awkward ones, so `--suppress` strings and config `rules`
  keys change accordingly; add a conformance test that enforces rule naming,
  motives, and test packs (#258).
- Add a `.xslint.yml` configuration file — rule severities and globs,
  `exclude`, `max-warnings`, `log-level`, `quiet` — resolved with `--config`
  and walk-up discovery (#261, #282, #283, #284, #285).
- Add c8 coverage measurement with a 90% gate and a Codecov badge (#265).
- Add scheduled Stryker mutation testing (#266).
- Parse each XPath rule once at load instead of once per file (#256).
- Compute each tokenizer probe once per position (#255).
- Apply the schema-type and node-set rules to XSLT 3.0 stylesheets (#259).
- Make the exit code severity-aware and add `--max-warnings` (#264).
- Send logs to stderr and defects to stdout, and add `--quiet` (#263).
- Add round-trip and offset property tests for the tokenizer (#267).
- Point the README badges at this repository (#254).

## 0.0.6 - 2026-06-29

- Published to npm.

## 0.0.5 - 2026-03-26

- Published to npm.

## 0.0.4 - 2026-03-12

- Published to npm.

## 0.0.3 - 2025-01-22

- Published to npm.

## 0.0.2 - 2025-01-22

- Published to npm.

## 0.0.1 - 2025-01-07

- First release to npm.
