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
    'Number of warnings to allow before the exit code becomes non-zero ' +
    '(-1 allows any number)',
    (value) => parseInt(value, 10),
  )
  .option(
    '--suppress <check>', 'Suppress some checks',
    (check, suppressions) => [...suppressions, check], [],
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
  process.exit(1)
}
