/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const path = require('path')
const {execSync, spawnSync} = require('child_process')

/**
 * Run the console command. A run told not to print captures nothing, and
 * `execSync` answers `null` rather than a buffer for it, so the empty string
 * stands in — without it the quiet form threw on every command that ran, which
 * reads exactly like a command that is not there (#645).
 * @param {string} command - Console Command
 * @param {Array.<string>} args - Arguments
 * @param {boolean} print - Capture logs or not
 * @return {string} Stdout
 */
const execCmd = function(command, args, print) {
  return (execSync(
    `${command} ${args.join(' ')}`,
    {
      timeout: 120000,
      windowsHide: true,
      stdio: print ? null : 'ignore',
    },
  ) ?? '').toString()
}

/**
 * Run xslint in a child process, exactly as a user would, so the test sees the
 * same output — no node warnings are silenced.
 * @param {Array.<string>} args - Array of args
 * @return {import('child_process').SpawnSyncReturns<string>} - Result
 */
const spawnXslint = function(args) {
  return spawnSync(
    'node',
    [path.resolve('./src/index.mjs'), ...args],
    {
      timeout: 120000,
      windowsHide: true,
      encoding: 'utf-8',
    },
  )
}

/**
 * Helper to run xslint, returning its stdout and stderr together.
 * @param {Array.<string>} args - Array of args
 * @return {string} Combined stdout and stderr
 */
const runXslint = function(args) {
  const result = spawnXslint(args)
  return `${result.stdout}${result.stderr}`
}

/**
 * Helper to run xslint and report its exit code.
 * @param {Array.<string>} args - Array of args
 * @return {number} Exit code
 */
const xslintStatus = function(args) {
  return spawnXslint(args).status
}

/**
 * Helper to run xslint, keeping stdout and stderr apart.
 * @param {Array.<string>} args - Array of args
 * @return {{stdout: string, stderr: string}} Streams
 */
const xslintStreams = function(args) {
  const result = spawnXslint(args)
  return {stdout: result.stdout, stderr: result.stderr}
}

/**
 * Helper to run xcop command line tool.
 * @param {string} arg - arg
 * @param {boolean} print - Capture logs
 * @return {string} Stdout
 */
const runXcop = function(arg, print = true) {
  return execCmd('xcop', [arg], print)
}

/**
 * Whether the tool runs here, asked by running it with the argument that proves
 * it does. Looking the name up in `PATH` was a proxy for that question, and the
 * two disagree: `which` walks `PATH` literally while the shell that starts the
 * tool expands a `~` in it, so an installed xcop read as absent and its 249
 * assertions went with it (#645). Running the tool also retires the
 * `where`/`which` fork, whose platform test compared a function with a string
 * and so never once took the Windows arm it was written for.
 * @param {string} cmd - Command
 * @param {Array.<string>} args - Arguments proving it runs
 * @param {boolean} print - Capture logs
 * @return {boolean} - Result
 */
const cmdAvailable = function(cmd, args, print) {
  let available = true
  try {
    execCmd(cmd, args, print)
  } catch {
    available = false
  }
  return available
}

module.exports = {
  runXslint,
  xslintStatus,
  xslintStreams,
  runXcop,
  cmdAvailable,
}
