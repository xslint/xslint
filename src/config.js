/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const fs = require('fs')
const path = require('path')
const {yaml} = require('./helpers')
const {logger} = require('./logger')

/**
 * Name of the project configuration file.
 * @type {string}
 */
const NAME = '.xslint.yml'

/**
 * Severities a rule may be re-graded to, plus 'off' to disable it.
 * @type {Array.<string>}
 */
const SEVERITIES = ['off', 'warning', 'error']

/**
 * Top-level keys the configuration understands. Anything else is a typo worth
 * reporting rather than silently ignoring.
 * @type {Array.<string>}
 */
const KEYS = [
  'rules', 'exclude', 'only', 'preset', 'max-warnings', 'log-level', 'quiet',
  'baseline',
]

/**
 * Nearest configuration file, searching from given directory up to the root.
 * @param {string} from - Directory to start the search in
 * @return {string|null} - Path of the found file, or null when none exists
 */
const located = function(from) {
  let dir = from
  let found = null
  while (!found) {
    const candidate = path.join(dir, NAME)
    if (fs.existsSync(candidate)) {
      found = candidate
    } else if (path.dirname(dir) === dir) {
      break
    } else {
      dir = path.dirname(dir)
    }
  }
  return found
}

/**
 * Value of a known key when it holds the expected type, noting a problem and
 * falling back to the default otherwise, so a mistyped value is as visible as
 * a mistyped key rather than silently ignored.
 * @param {object|null} raw - Parsed YAML, or null when there is no file
 * @param {string} key - Key to read
 * @param {function(*): boolean} ok - Whether the value has the expected type
 * @param {string} expected - Human name of the expected type, for the problem
 * @param {*} fallback - Value to use when the key is absent or mistyped
 * @param {Array.<string>} problems - Where a mistyped value is noted
 * @return {*} - The value when it fits, the fallback otherwise
 */
const typed = function(raw, key, ok, expected, fallback, problems) {
  const present = Boolean(raw) && Object.hasOwn(raw, key)
  const fits = present && ok(raw[key])
  if (present && !fits) {
    problems.push(`Value of '${key}' in ${NAME} must be ${expected}, ignoring it`)
  }
  let value = fallback
  if (fits) {
    value = raw[key]
  }
  return value
}

/**
 * Normalize the parsed YAML into the configuration the linter consumes,
 * answering any unknown top-level key, any rule graded to an unknown severity,
 * and any known key holding the wrong type as a problem rather than dropping
 * them silently, for the caller to print or show where it will (#1128).
 * @param {object|null} raw - Parsed YAML, or null when there is no file
 * @return {{rules: object, exclude: Array.<string>, only: Array.<string>,
 *  preset: ?string, maxWarnings: ?number, logLevel: ?string, quiet: ?boolean,
 *  baseline: ?string, problems: Array.<string>}} - Normalized configuration
 */
const normalized = function(raw) {
  const problems = Object.keys(raw || {})
    .filter((key) => !KEYS.includes(key))
    .map((key) => `Unknown key '${key}' in ${NAME}`)
  const rules = {}
  for (const [name, severity] of Object.entries(raw && raw.rules || {})) {
    if (SEVERITIES.includes(severity)) {
      rules[name] = severity
    } else {
      problems.push(
        [
          `Invalid severity '${severity}' for rule '${name}' in ${NAME},`,
          `use one of ${SEVERITIES.join(', ')}`,
        ].join(' '),
      )
    }
  }
  return {
    rules: rules,
    exclude: typed(
      raw, 'exclude',
      (val) => Array.isArray(val) && val.every((it) => typeof it === 'string'),
      'a list of strings', [], problems,
    ),
    only: typed(
      raw, 'only',
      (val) => Array.isArray(val) && val.every((it) => typeof it === 'string'),
      'a list of strings', [], problems,
    ),
    preset: typed(
      raw, 'preset', (val) => typeof val === 'string', 'a string', null,
      problems,
    ),
    maxWarnings: typed(
      raw, 'max-warnings',
      (val) => typeof val === 'number' && !Number.isNaN(val), 'a number', null,
      problems,
    ),
    logLevel: typed(
      raw, 'log-level', (val) => typeof val === 'string', 'a string', null,
      problems,
    ),
    quiet: typed(
      raw, 'quiet', (val) => typeof val === 'boolean', 'a boolean', null,
      problems,
    ),
    baseline: typed(
      raw, 'baseline', (val) => typeof val === 'string', 'a string', null,
      problems,
    ),
    problems: problems,
  }
}

/**
 * Resolve the configuration: the file named by '--config' when given, otherwise
 * the nearest '.xslint.yml' from the working directory upward, otherwise the
 * empty defaults. The 'file' is the one read, absent when there is none, and
 * the 'base' the directory the globs resolve against — where the file lives,
 * or the search origin when there is no file (#1136).
 * @param {string|undefined} explicit - Path from '--config', if any
 * @param {string} from - Directory the search starts in
 * @return {{rules: object, exclude: Array, only: Array, preset: ?string,
 *  maxWarnings: ?number, logLevel: ?string, quiet: ?boolean, baseline: ?string,
 *  problems: Array, base: string, file: (string|undefined)}} - Configuration
 */
const configFrom = function(explicit, from = process.cwd()) {
  let file
  if (explicit) {
    file = path.resolve(from, explicit)
  } else {
    file = located(from) ?? undefined
  }
  let raw = null
  let base = from
  if (file) {
    raw = yaml.parsedFromFile(file)
    base = path.dirname(file)
    logger.debug(`Configuration loaded from ${file}`)
  }
  return {...normalized(raw), base: base, file: file}
}

module.exports = {
  configFrom,
}
