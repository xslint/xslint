/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {logger, levels} = require('../src/logger')
const assert = require('assert')

/**
 * Set the level, run a logging action, and capture what reaches the console,
 * restoring the default level afterwards so no state leaks to other files.
 * @param {string} level - Level to set first
 * @param {function(): void} act - Logging to run
 * @return {string} - The captured output
 */
const captured = function(level, act) {
  const original = console.error
  const lines = []
  console.error = (...args) => lines.push(args.join(' '))
  try {
    logger.setLevel(level)
    act()
  } finally {
    console.error = original
    logger.setLevel(levels.INFO)
  }
  return lines.join('\n')
}

/**
 * Cases where a method logged at a given level does or does not reach output.
 * @type {Array.<{name: string, level: string, method: string, message: string,
 *  shown: boolean}>}
 */
const CASES = [
  {
    name: 'emits a debug line when the level allows it',
    level: levels.DEBUG,
    method: 'debug',
    message: 'dbg',
    shown: true,
  },
  {
    name: 'drops an info line above its level',
    level: levels.ERROR,
    method: 'info',
    message: 'inf',
    shown: false,
  },
  {
    name: 'drops a warning above its level',
    level: levels.ERROR,
    method: 'warn',
    message: 'wrn',
    shown: false,
  },
  {
    name: 'always emits an error line',
    level: levels.ERROR,
    method: 'error',
    message: 'err',
    shown: true,
  },
]

describe('logger', function() {
  CASES.forEach(({name, level, method, message, shown}) => {
    it(name, function() {
      assert.equal(
        captured(level, () => logger[method](message)).includes(message),
        shown,
      )
    })
  })
  it('drops a warning logged while hushed', function() {
    assert.equal(
      captured(levels.INFO, () => logger.hushed(() => logger.warn('hsh')))
        .includes('hsh'),
      false,
    )
  })
  it('logs at its own level once a hushed action ends', function() {
    assert.ok(
      captured(levels.INFO, () => {
        logger.hushed(() => undefined)
        logger.info('back')
      }).includes('back'),
    )
  })
  it('hands back what the hushed action returns', function() {
    assert.equal(logger.hushed(() => 'kept'), 'kept')
  })
  it('warns about an unknown level', function() {
    assert.ok(
      captured(levels.DEBUG, () => logger.setLevel('nonsense'))
        .includes('incorrect'),
    )
  })
})
