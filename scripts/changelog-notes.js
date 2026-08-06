/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

const fs = require('fs')

const version = process.argv[2]
if (!version) {
  throw new Error('usage: changelog-notes.js <version>')
}

const lines = fs.readFileSync('CHANGELOG.md', 'utf-8').split('\n')

/**
 * Trimmed body of the "## <heading>" section, empty when it is absent.
 * @param {string} heading - Section heading to read
 * @return {string} - Section body
 */
const section = function(heading) {
  const start = lines.findIndex(
    (line) => line === `## ${heading}` || line.startsWith(`## ${heading} `),
  )
  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith('## '),
  )
  let end = next
  if (next < 0) {
    end = lines.length
  }
  let body = ''
  if (start >= 0) {
    body = lines.slice(start + 1, end).join('\n').trim()
  }
  return body
}

// Prefer this version's section; fall back to Unreleased, then a bare line, so
// an automated cascade with no human to curate the changelog is never blocked.
const notes = section(version) || section('Unreleased') || `Release ${version}`
process.stdout.write(`${notes}\n`)
