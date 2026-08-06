/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

'use strict'

module.exports = function(grunt) {
  grunt.initConfig({
    eslint: {
      target: [
        'Gruntfile.js', 'eslint-local-rules.js', 'src/**/*.js', 'src/**/*.mjs',
        'test/**/*.js', 'scripts/**/*.js',
      ],
    },
    mochacli: {
      test: {
        options: {
          files: ['test/**/*.test.js', '!test/resources/**'],
          timeout: 10000,
        },
      },
    },
  })
  grunt.loadNpmTasks('grunt-eslint')
  grunt.loadNpmTasks('grunt-mocha-cli')
  grunt.registerTask('docs', 'Generate documentation site', function() {
    require('./scripts/generate-docs')
  })
  grunt.registerTask('default', ['eslint', 'mochacli'])
}
