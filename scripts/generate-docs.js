/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

const path = require('path')
const fs = require('fs')
const {allFilesFrom, yaml} = require('../src/helpers')
const {marked} = require('marked')

const CHECKS = path.join(__dirname, '..', 'src', 'resources', 'checks')
const MOTIVES = path.join(__dirname, '..', 'src', 'resources', 'motives')
const DOCS = path.join(__dirname, '..', 'docs')
const CHECKS_DIR = path.join(DOCS, 'checks')
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

  fs.mkdirSync(CHECKS_DIR, {recursive: true})

  const indexRows = checks.map(({name, kind, lint}) => {
    return `  <tr>
    <td><a href="checks/${name}.html">${name}</a></td>
    <td>${kind}</td>
    <td>${severityBadge(lint.severity)}</td>
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
  <p>${checks.length} checks, each with its rationale:</p>
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
    ${severityBadge(lint.severity)}
    ${expressions(kind, lint)}
  </div>
  <div class="check-content">
${mdHtml}
  </div>`

    fs.writeFileSync(
      path.join(CHECKS_DIR, `${name}.html`),
      page(name, checkBody, true),
    )
  }

  console.log(`Generated docs for ${checks.length} checks in ${DOCS}`)
}

generate()

module.exports = generate
