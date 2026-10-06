#! /usr/bin/env node
/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

import {program, Option} from 'commander'
import version from './version.js'

program
  .name('xslint')
  .usage('path [options]')
  .summary('XSL Linter')
  .description(
    'XLS Linter (' + version.what + ' built on ' + version.when + ')',
  )
  .version(version.what, '-v, --version', 'Output the version number')
  .helpOption('-?, --help', 'Print this help information')
  .option('--log-level <level>', 'Set log level')
  .option('--quiet', 'Suppress informational logs, printing only defects')
  .addOption(
    new Option('--format <format>', 'Output format for defects')
      .choices(['text', 'json', 'sarif', 'github'])
      .default('text'),
  )
  .option('--config <path>', 'Path to a configuration file')
  .option(
    '--baseline <file>',
    'Report only the defects the baseline file does not record',
  )
  .option(
    '--baseline-write <file>',
    'Record every defect found into the baseline file and report none',
  )
  .addOption(
    new Option(
      '--baseline-prune',
      'Drop the entries of the baseline file the run no longer draws',
    ).conflicts(['baselineWrite', 'fix', 'fixDryRun', 'fixSuggestions']),
  )
  .option('--fix', 'Rewrite the fixable defects in place')
  .option(
    '--fix-suggestions',
    'Apply the suggested fixes too, not just the safe ones',
  )
  .option(
    '--fix-dry-run',
    'Report what --fix would change without writing files',
  )
  .option(
    '--max-warnings <n>',
    [
      'Number of warnings to allow before the exit code becomes non-zero',
      '(-1 allows any number)',
    ].join(' '),
    (value) => parseInt(value, 10),
  )
  .option(
    '--suppress <check>', 'Suppress some checks',
    (check, suppressions) => [...suppressions, check], [],
  )
  .option(
    '--only <check>', 'Report only the checks whose names hold this substring',
    (check, choices) => [...choices, check], [],
  )
  .option(
    '--preset <name>',
    'Run the checks of a preset: recommended (the default) or all',
  )
  .argument('[paths...]', 'paths to file or directory to process', ['.'])
  .action(async (path) => {
    const {default: xslint} = await import('./xslint.js')
    xslint(path, program.opts())
  })

try {
  await program.parseAsync(process.argv)
} catch (error) {
  console.error(error.message)
  console.error(error.stack)
  process.exitCode = 1
}
