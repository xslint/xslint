/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

/**
 * Milliseconds one test may take before mocha calls it hung. Both targets share
 * it: the split decides which files run, never how patient the runner is with
 * any one of them.
 * @type {number}
 */
const TIMEOUT = 10000

module.exports = function(grunt) {
  grunt.initConfig({
    eslint: {
      target: [
        'Gruntfile.js', 'eslint-local-rules.js', 'src/**/*.js', 'src/**/*.mjs',
        'test/**/*.js', 'scripts/**/*.js',
      ],
    },
    mochacli: {
      fast: {
        options: {
          files: [
            'test/**/*.test.js',
            '!test/**/*.deep.test.js',
            '!test/resources/**',
          ],
          timeout: TIMEOUT,
        },
      },
      deep: {
        options: {
          files: ['test/**/*.deep.test.js', '!test/resources/**'],
          timeout: TIMEOUT,
          parallel: true,
        },
      },
    },
  })
  grunt.loadNpmTasks('grunt-eslint')
  grunt.loadNpmTasks('grunt-mocha-cli')
  grunt.registerTask('docs', 'Generate documentation site', function() {
    require('./scripts/generate-docs')
  })
  grunt.registerTask('checks', 'Rebuild the checks a run reads', function() {
    grunt.log.writeln(require('./scripts/generate-checks').generate())
  })
  grunt.registerTask(
    'fast', 'Lint, then run every test that starts no process',
    ['eslint', 'mochacli:fast'],
  )
  grunt.registerTask('default', ['eslint', 'mochacli'])
}
