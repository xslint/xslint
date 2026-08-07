/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {allFilesFrom, yaml} = require('../src/helpers')
const fs = require('fs')
const path = require('path')

/**
 * Where the checks are authored, and where the file built from them lands.
 * @type {{from: string, to: string}}
 */
const PLACE = {
  from: path.join(__dirname, '..', 'src', 'resources', 'checks'),
  to: path.join(__dirname, '..', 'src', 'resources', 'checks.json'),
}

/**
 * What the file says about itself, since JSON cannot carry a comment.
 * @type {string}
 */
const NOTE = 'Generated from checks/*/*.yaml by scripts/generate-checks.js; ' +
  'the YAML is where a check is authored, this is only how a process reads ' +
  'one without a parser. Run `npx grunt checks` rather than editing it.'

/**
 * Every check, kind by kind, read off the YAML that authors it.
 * @return {object} - The four kinds, each a name-keyed map of checks
 */
const authored = function() {
  return Object.fromEntries(
    fs.readdirSync(PLACE.from, {withFileTypes: true})
      .filter((entry) => entry.isDirectory())
      .map((kind) => [
        kind.name,
        Object.fromEntries(
          allFilesFrom(path.join(PLACE.from, kind.name))
            .filter((file) => file.endsWith('.yaml'))
            .map((file) => [
              path.basename(file, '.yaml'), yaml.parsedFromFile(file),
            ]),
        ),
      ]),
  )
}

/**
 * The file text carrying them. JSON, not JavaScript: `require` parses it with
 * the parser built into the runtime, so a process reads all 67 checks without
 * loading `yaml` at all — 31 of the 71 ms the pipeline spent loading (#689) —
 * and REUSE already exempts `*.json` from the SPDX header a `.js` would owe.
 * @param {object} checks - What {@link authored} read
 * @return {string} - The file
 */
const rendered = function(checks) {
  return `${JSON.stringify({note: NOTE, kinds: checks}, null, 2)}\n`
}

module.exports = {
  /**
   * Write the file, and say where it went.
   * @return {string} - Where it was written
   */
  generate: function() {
    fs.writeFileSync(PLACE.to, rendered(authored()))
    return PLACE.to
  },
  authored,
  rendered,
  PLACE,
}
