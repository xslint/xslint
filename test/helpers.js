/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const fs = require('fs')
const path = require('path')
const {execSync, spawn, spawnSync} = require('child_process')

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
 * The line a run prints to stderr just before it writes its report, which is
 * what tells a reader the writing is about to start. Reading it beats waiting a
 * fixed time: what takes the run its while is the linting, and how long that
 * takes is the machine's business, where the writing that follows is prompt
 * everywhere.
 * @type {string}
 */
const COUNTED = 'Defects found:'

/**
 * What xslint writes into a pipe nobody reads until it has finished writing,
 * beside the log it kept while doing it.
 *
 * Node's stdout is asynchronous to a pipe on POSIX, so a run that leaves
 * through `process.exit` abandons every write the kernel has not taken — which
 * is the whole of the report where the reader is slow enough, the report being
 * the last thing written (#767). A reader that stays paused until the run says
 * how many defects it found forces that: the writes queue behind a pipe nobody
 * is emptying, and only then does the reader drain.
 * The trigger has a fallback behind it, since a run that never reaches the
 * summary would otherwise leave the pipe unread and the promise unsettled.
 * @param {Array.<string>} args - Array of args
 * @param {number} settling - Milliseconds to leave the pipe unread once the
 *  summary says the report is coming
 * @return {Promise<{report: string, log: string}>} - What arrived on stdout,
 *  and the whole of stderr
 */
const xslintUnread = function(args, settling) {
  return new Promise((resolve) => {
    const child = spawn(
      'node',
      [path.resolve('./src/index.mjs'), ...args],
      {windowsHide: true},
    )
    const said = {report: '', log: '', status: null, ended: false}
    let drained = false
    /**
     * Hand back what arrived, once the pipe has ended and the child has gone.
     */
    const settle = function() {
      if (said.ended && said.status !== null) {
        resolve({report: said.report, log: said.log})
      }
    }
    /**
     * Start reading the pipe the run has been writing into.
     */
    const drain = function() {
      if (!drained) {
        drained = true
        child.stdout.on('data', (chunk) => {
          said.report += chunk
        })
        child.stdout.resume()
      }
    }
    child.stdout.setEncoding('utf-8')
    child.stderr.setEncoding('utf-8')
    child.stdout.pause()
    child.stdout.on('end', () => {
      said.ended = true
      settle()
    })
    child.stderr.on('data', (chunk) => {
      said.log += chunk
      if (said.log.includes(COUNTED)) {
        setTimeout(drain, settling)
      }
    })
    child.on('close', (code) => {
      said.status = code
      settle()
    })
    setTimeout(drain, settling * 20)
  })
}

/**
 * The line xcop prints about a stylesheet it accepts.
 * @type {RegExp}
 */
const GOOD = /^(.*) looks good$/

/**
 * The line it prints about one that is not XML at all, which it steps over
 * rather than stopping at.
 * @type {RegExp}
 */
const SKIPPED = /^(.*) is not a well-formed XML, skipping it$/

/**
 * The two lines it stops on: a stylesheet whose formatting it refuses, and one
 * its schema refuses. Both end the run where they stand, so both are what
 * leaves the files behind them unjudged.
 * @type {RegExp}
 */
const REFUSED = /^(?:Invalid XML formatting in|XSD validation failed in) (.*)$/

/**
 * What a refused stylesheet is renamed to, so the next pass steps over it: xcop
 * globs five extensions and this is none of them, which is a narrower promise
 * than moving the file away and keeps it where whoever reads the failure can
 * find it.
 * @type {string}
 */
const SHELVED = '.refused'

/**
 * What xcop prints about the stylesheets a directory holds, in one run. A file
 * it refuses makes the process exit non-zero and `execSync` announces that by
 * throwing, so the report is read off the failure rather than lost with it; a
 * tool that is not there throws too, with nothing to read, and `cmdAvailable`
 * is what tells those two apart. Colour is turned off because what this output
 * becomes is a test failure message, read as often in a CI log as in a
 * terminal.
 * @param {string} dir - Directory holding the stylesheets
 * @return {string} - Stdout, whether xcop finished or stopped
 */
const printedBy = function(dir) {
  let printed
  try {
    printed = execCmd('xcop', ['--nocolor', dir], true)
  } catch (refusal) {
    printed = (refusal.stdout ?? '').toString()
  }
  return printed
}

/**
 * What one run of xcop said about each file it named. Three of its lines are a
 * verdict on one stylesheet — it looks good, it is not well-formed and was
 * skipped, or it is refused — and everything between two verdicts belongs to
 * the one that follows, a refusal being printed behind the diff explaining it.
 * @param {string} printed - What one run printed
 * @return {Map.<string, {good: boolean, refused: boolean, said: string}>} -
 *  Each file it named, against its verdict
 */
const parted = function(printed) {
  const said = new Map()
  let held = []
  printed.split('\n').forEach((line) => {
    const good = GOOD.exec(line)
    const skipped = SKIPPED.exec(line)
    const refused = REFUSED.exec(line)
    if (good !== null) {
      said.set(good[1], {good: true, refused: false, said: line})
      held = []
    } else if (skipped !== null) {
      said.set(skipped[1], {good: false, refused: false, said: line})
      held = []
    } else if (refused !== null) {
      said.set(refused[1], {
        good: false, refused: true, said: held.concat([line]).join('\n'),
      })
      held = []
    } else {
      held = held.concat([line])
    }
  })
  return said
}

/**
 * What xcop makes of every stylesheet a directory holds, one verdict per file.
 *
 * It is asked over the directory rather than once per file, which is the
 * difference between 0.1 seconds and 25 of them (#687), and a directory is
 * what it is asked over rather than a list of paths because `cmd.exe` takes a
 * command line of 8191 characters and 356 of these are four times that.
 *
 * What one run cannot give is a verdict on every file, xcop stopping at the
 * first stylesheet it refuses: everything behind that one goes unmentioned, so
 * every assertion over it failed, all with the same message, and none naming
 * the file that actually broke — 204 of them at once, the one real complaint
 * printed by nobody (#694). So a refusal is recorded against the file it names
 * and that file is renamed out of the extensions xcop globs, and the run is
 * asked again from there. Each pass either finds a fresh refusal or is the
 * last, so a sound directory costs one process and a directory holding two bad
 * files costs three, and nothing but a bad file ever fails.
 *
 * A file the run never mentioned at all is not left to assert against nothing
 * either: it takes the whole of what xcop printed as its verdict, since a tool
 * that answers about nobody has still said the only thing there is to know.
 * @param {string} dir - Directory holding the stylesheets
 * @param {Array.<string>} files - The stylesheets a caller expects a verdict on
 * @return {Map.<string, {good: boolean, refused: boolean, said: string}>} -
 *  Each of those files, against what xcop made of it
 */
const xcopped = function(dir, files) {
  const judged = new Map()
  let printed = ''
  let more = true
  while (more) {
    const pass = printedBy(dir)
    printed = `${printed}${pass}`
    const fresh = Array.from(parted(pass))
      .filter(([file]) => !judged.has(file))
    fresh.forEach(([file, verdict]) => judged.set(file, verdict))
    const stopped = fresh.filter(([, verdict]) => verdict.refused)
    stopped.forEach(([file]) => fs.renameSync(file, `${file}${SHELVED}`))
    more = stopped.length > 0
  }
  files.filter((file) => !judged.has(file)).forEach((file) => judged.set(file, {
    good: false,
    refused: false,
    said: `xcop named no verdict for this file, and printed:\n${printed}`,
  }))
  return judged
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

/**
 * What a script of `scripts/` says and answers when the shell runs it, which is
 * the only way a caller learns either: the nightly workflow reads the exit code
 * of `scripts/budget.js` and prints its line, so a test of the message alone
 * would leave the half that arms the gate untested (#785).
 * @param {string} script - Path of the script, from the repository root
 * @param {Array.<string>} args - What the shell hands it
 * @return {{code: number, said: string}} - Its status and what it printed
 */
const ranScript = function(script, args) {
  const result = spawnSync(
    'node',
    [path.resolve(script)].concat(args),
    {timeout: 120000, windowsHide: true, encoding: 'utf-8'},
  )
  return {
    code: result.status,
    said: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

module.exports = {
  ranScript,
  walkedWith,
  runXslint,
  xslintStatus,
  xslintStreams,
  xslintUnread,
  xcopped,
  cmdAvailable,
}
