/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

const path = require('path')
const fs = require('fs')
const {allFilesFrom, yaml} = require('../src/helpers')
const {SAFE, SUGGESTION, TIERS} = require('../src/checks')
const {marked} = require('marked')

const CHECKS = path.join(__dirname, '..', 'src', 'resources', 'checks')
const MOTIVES = path.join(__dirname, '..', 'src', 'resources', 'motives')
const MANUAL = path.join(__dirname, '..', 'src', 'resources', 'manual')
const DOCS = path.join(__dirname, '..', 'docs')
const CHECKS_DIR = path.join(DOCS, 'checks')
const MANUAL_DIR = path.join(DOCS, 'manual')
const KINDS = ['xpath', 'corpus', 'validation', 'format']

const CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #24292e;
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 32px;
  }
  h1 { font-size: 2rem; font-weight: 600; margin-bottom: 4px; }
  h2 { font-size: 1.3rem; font-weight: 600; margin: 20px 0 8px; }
  a { color: #0366d6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  p { margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.9rem; }
  th {
    text-align: left;
    padding: 10px 12px;
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    font-weight: 600;
  }
  td { padding: 10px 12px; border: 1px solid #e1e4e8; vertical-align: top; }
  tr:hover td { background: #f6f8fa; }
  .severity-warning {
    background: #fff8c5;
    color: #9a6700;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .severity-error {
    background: #ffebe9;
    color: #cf222e;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .fix-safe {
    background: #dafbe1;
    color: #1a7f37;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .fix-suggestion {
    background: #fbefff;
    color: #8250df;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .preset-recommended {
    background: #ddf4ff;
    color: #0969da;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .fix-note {
    background: #f6f8fa;
    border-left: 4px solid #57606a;
    padding: 8px 12px;
    margin: 0 0 24px;
    font-size: 0.9rem;
  }
  .back { display: inline-block; margin-bottom: 24px; font-size: 0.9rem; }
  .meta { display: flex; gap: 12px; align-items: flex-start; margin: 12px 0 24px; flex-wrap: wrap; }
  .xpath {
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 4px;
    padding: 6px 10px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem;
    word-break: break-all;
    flex: 1;
  }
  pre { margin: 12px 0; border-radius: 6px; overflow-x: auto; }
  code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
  .check-content h1 { font-size: 1.6rem; margin-bottom: 8px; }
`

const HLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0'

const page = (title, content, withHighlight) => {
  let highlight = ''
  if (withHighlight) {
    highlight = `
  <link rel="stylesheet" href="${HLJS_CDN}/styles/github.min.css">
  <script src="${HLJS_CDN}/highlight.min.js"></script>
  <script src="${HLJS_CDN}/languages/xml.min.js"></script>
  <script>hljs.highlightAll();</script>`
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${CSS}</style>${highlight}
</head>
<body>
${content}
</body>
</html>`
}

const severityBadge = (severity) => {
  return `<span class="severity-${severity}">${severity}</span>`
}

const FIXED = {[SAFE]: 'safe fix', [SUGGESTION]: 'suggested fix'}

const NOTED = {
  [SAFE]: `<code>--fix</code> rewrites this one: the correction is
  deterministic, and leaves the stylesheet meaning what it meant.`,
  [SUGGESTION]: `<code>--fix-suggestions</code> rewrites this one, and a plain
  <code>--fix</code> leaves it alone: the correction changes what the
  stylesheet does, or is one of several the check would accept.`,
  [`${SAFE} ${SUGGESTION}`]: `<code>--fix</code> rewrites this one where the
  correction is deterministic and <code>--fix-suggestions</code> where it is
  not, which of the two it is depending on where the construct stands.`,
}

const tiered = (lint) => {
  return TIERS.filter((tier) => [lint.fix ?? []].flat().includes(tier))
}

const fixBadge = (lint) => {
  return tiered(lint)
    .map((tier) => ` <span class="fix-${tier}">${FIXED[tier]}</span>`)
    .join('')
}

const fixNote = (lint) => {
  const tiers = tiered(lint)
  let note = ''
  if (tiers.length > 0) {
    note = `\n  <p class="fix-note">${NOTED[tiers.join(' ')]}</p>`
  }
  return note
}

const presetBadge = (lint) => {
  let badge = ''
  if (lint.preset === 'recommended') {
    badge = ' <span class="preset-recommended">recommended</span>'
  }
  return badge
}

const escaped = (xpath) => xpath.replace(/</g, '&lt;').replace(/>/g, '&gt;')

const expressions = (kind, lint) => {
  let shown
  if (kind === 'corpus') {
    shown = `<code class="xpath">declaration: ${
      escaped(lint.declaration)}</code>
    <code class="xpath">usage: ${escaped(lint.usage)}</code>`
  } else if (kind === 'validation') {
    shown =
      `<code class="xpath">verified by the parser, not an XPath rule</code>`
  } else if (kind === 'format') {
    shown =
      `<code class="xpath">checked over the tokens, not an XPath rule</code>`
  } else {
    shown = `<code class="xpath">${escaped(lint.xpath)}</code>`
  }
  return shown
}

const generate = function() {
  const checks = KINDS.flatMap((kind) => allFilesFrom(path.join(CHECKS, kind))
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .map((yamlFile) => {
      const name = path.basename(yamlFile, '.yaml')
      const lint = yaml.parsedFromFile(yamlFile)
      const mdFile = path.join(MOTIVES, kind, `${name}.md`)
      let md = null
      if (fs.existsSync(mdFile)) {
        md = fs.readFileSync(mdFile, 'utf-8')
      }
      return {name, kind, lint, md}
    }))

  const pages = fs.readdirSync(MANUAL)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const md = fs.readFileSync(path.join(MANUAL, file), 'utf-8')
      return {
        name: path.basename(file, '.md'),
        title: md.split('\n')[0].replace(/^# /, ''),
        md,
      }
    })

  fs.mkdirSync(CHECKS_DIR, {recursive: true})
  fs.mkdirSync(MANUAL_DIR, {recursive: true})

  const manualItems = pages
    .map(({name, title}) => `    <li><a href="manual/${name}.html">${title}</a></li>`)
    .join('\n')

  const indexRows = checks.map(({name, kind, lint}) => {
    return `  <tr>
    <td><a href="checks/${name}.html">${name}</a></td>
    <td>${kind}</td>
    <td>${severityBadge(lint.severity)}${fixBadge(lint)}${presetBadge(lint)}</td>
    <td>${lint.message}</td>
  </tr>`
  }).join('\n')

  const indexBody = `  <h1>xslint</h1>
  <p>A linter for XSL/XSLT stylesheets. It first checks that every stylesheet is
  well-formed and every XPath expression compiles, then flags stylistic,
  semantic, and logical mistakes &mdash; each pinpointed to its exact line and
  column, with a fix where the correction is unambiguous. Think of it as the
  checks ESLint gives JavaScript, but for XSL.</p>

  <h2>Run it</h2>
  <pre><code>npx @maxonfjvipon/xslint path/to/stylesheets</code></pre>
  <p>It also runs in your editor &mdash;
  <a href="https://open-vsx.org/extension/maxonfjvipon/xslint-vscode">VS Code and compatible editors</a>
  and <a href="https://plugins.jetbrains.com/plugin/33167">JetBrains IDEs</a> &mdash;
  in CI via the <a href="https://github.com/xslint/xslint-action">GitHub Action</a>,
  or embedded through the
  <a href="https://github.com/xslint/xslint-lsp">language server</a>.</p>

  <h2>Manual</h2>
  <ul>
${manualItems}
  </ul>

  <h2>What it reports</h2>
  <pre><code>[ERROR]   sheet.xsl(2:1) The xsl:output instruction is missing. (not-using-output)
[WARNING] sheet.xsl(3:3) The match attribute starts with //, which scans the whole tree. (starts-with-double-slash)
[WARNING] sheet.xsl(4:5) A variable has a single-character name. (short-names)</code></pre>

  <h2>Proven on real code</h2>
  <p>Pointed at core stylesheets from the three most widely-used XSLT projects
  &mdash; <a href="https://github.com/docbook/xslt10-stylesheets">DocBook-XSL</a>
  (1.0), <a href="https://github.com/TEIC/Stylesheets">TEI</a> (2.0), and
  <a href="https://github.com/dita-ot/dita-ot">DITA-OT</a> (1.0/2.0), 70 files
  in all &mdash; xslint surfaced 1,974 findings across 22 different checks, with
  no false positives from its validators: 106 <code>xsl:choose</code> blocks
  with no <code>xsl:otherwise</code>, 67 unused named templates, 40 stylesheet
  functions never called, and more. Real stylistic and logical findings in code
  that has shipped for decades.</p>

  <h2>Checks</h2>
  <p>${checks.length} checks, each with its rationale. A run reports the
  ${checks.filter(({lint}) => lint.preset === 'recommended').length} marked
  <span class="preset-recommended">recommended</span> unless asked for
  <code>--preset all</code>: what a processor refuses, and the dead code whose
  report is almost never wrong.</p>
  <table>
    <thead>
      <tr>
        <th>Check</th>
        <th>Type</th>
        <th>Severity</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
${indexRows}
    </tbody>
  </table>`

  fs.writeFileSync(
    path.join(DOCS, 'index.html'),
    page('xslint — a linter for XSL/XSLT', indexBody, false),
  )

  for (const {name, kind, lint, md} of checks) {
    let mdHtml = `<h1>${name}</h1><p>${lint.message}</p>`
    if (md) {
      mdHtml = marked(md)
    }
    const checkBody = `  <a class="back" href="../index.html">← all checks</a>
  <div class="meta">
    ${severityBadge(lint.severity)}${fixBadge(lint)}${presetBadge(lint)}
    ${expressions(kind, lint)}
  </div>${fixNote(lint)}
  <div class="check-content">
${mdHtml}
  </div>`

    fs.writeFileSync(
      path.join(CHECKS_DIR, `${name}.html`),
      page(name, checkBody, true),
    )
  }

  for (const {name, title, md} of pages) {
    fs.writeFileSync(
      path.join(MANUAL_DIR, `${name}.html`),
      page(title, `  <a class="back" href="../index.html">← all checks</a>
  <div class="check-content">
${marked(md)}
  </div>`, true),
    )
  }

  console.log([
    `Generated docs for ${checks.length} checks and`,
    `${pages.length} manual pages in ${DOCS}`,
  ].join(' '))
}

generate()

module.exports = generate
