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
  let stdio = 'ignore'
  if (print) {
    stdio = null
  }
  return (execSync(
    `${command} ${args.join(' ')}`,
    {
      timeout: 120000,
      windowsHide: true,
      stdio: stdio,
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
 * What xcop says about every stylesheet in a directory, in one run. It reports
 * a line per file, so a caller asking about 257 of them learns the same from
 * one interpreter as from 257 — which is the difference between 0.1 seconds and
 * 25 of them (#687). A file it rejects makes the whole process exit non-zero
 * and `execSync` announces that by throwing, so the report is read off the
 * failure rather than lost with it; a tool that is not there throws too, with
 * nothing to read, and `cmdAvailable` is what tells those two apart.
 * @param {string} dir - Directory holding the stylesheets
 * @return {string} Stdout, one line per file
 */
const xcopped = function(dir) {
  let printed
  try {
    printed = runXcop(dir, true)
  } catch (refusal) {
    printed = (refusal.stdout ?? '').toString()
  }
  return printed
}

/**
 * What the child is asked to do: report how large a spread this stack allows,
 * then walk the directory it was given and report what it found — or, when the
 * walk dies of the very limit just measured, the complaint it died with.
 *
 * The measurement is the part that keeps the answer honest. A walk that
 * survives proves nothing unless the trap was armed, and how many arguments a
 * spread may carry is V8's business rather than something a test can assert
 * from outside: it is roughly 125 per kilobyte of stack here, and a Node that
 * moved that number would leave a test silently proving nothing. So the child
 * spends the banned shape on purpose, binary-searching the ceiling, and hands
 * it back beside the walk's own answer for the caller to weigh (#758).
 * @type {string}
 */
const PROBE = `
const {allFilesFrom} = require(process.argv[1])
const fits = function(size) {
  let ok = true
  try {
    [].push(...new Array(size).fill('x'))
  } catch (err) {
    ok = false
  }
  return ok
}
let low = 100
let high = 200000
while (low < high - 100) {
  const mid = Math.floor((low + high) / 2)
  if (fits(mid)) {
    low = mid
  } else {
    high = mid
  }
}
let found = 0
try {
  found = allFilesFrom(process.argv[2]).length
} catch (refusal) {
  found = refusal.message
}
console.log(JSON.stringify({ceiling: low, found: found}))
`

/**
 * What `allFilesFrom` answers about a directory in a process whose JavaScript
 * stack is as small as it can be, beside the largest spread that stack allows.
 * Scaling the stack down is how a test reaches the crash of #758 without
 * building the 125,000-file directory it takes to reach it at full size — the
 * ceiling falls with the stack, so a caller sizes its tree off the answer and
 * writes a fifth more files than the spread carries rather than a hundred
 * thousand. How small the stack can be is not ours to decide, though: node
 * needs some seventy kilobytes to start here and more where a platform's
 * frames are wider, so the ask doubles until one answers, and the stack that
 * did comes back for the caller to ask the same of the walk itself.
 * @param {string} dir - Directory to walk
 * @param {number} kilobytes - The smallest stack worth asking for
 * @return {{ceiling: number, found: number|string, stack: number}} - The
 *  largest spread that stack carries, the number of files the walk found or
 *  its complaint, and the stack it took to answer at all
 */
const walkedWith = function(dir, kilobytes) {
  let answer = null
  const complaints = []
  for (const stack of [kilobytes, kilobytes * 2, kilobytes * 4]) {
    if (answer === null) {
      const result = spawnSync(
        'node',
        [
          `--stack-size=${stack}`, '-e', PROBE,
          path.resolve('./src/helpers'), dir,
        ],
        {
          timeout: 120000,
          windowsHide: true,
          encoding: 'utf-8',
        },
      )
      const said = result.stdout ?? ''
      complaints.push(`${stack}kB: ${said}${result.stderr ?? ''}`)
      if (said.startsWith('{')) {
        answer = {...JSON.parse(said), stack: stack}
      }
    }
  }
  if (answer === null) {
    throw new Error(
      `no stack from ${kilobytes}kB up let node answer about ${dir}, ` +
        `${complaints.join(', ')}`,
    )
  }
  return answer
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
  walkedWith,
  runXslint,
  xslintStatus,
  xslintStreams,
  runXcop,
  xcopped,
  cmdAvailable,
}
