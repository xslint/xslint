/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {err} = require('./output')

/**
 * Log levels.
 * @type {{ERROR: string, INFO: string, DEBUG: string, WARNING: string}}
 */
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
}

/**
 * Log levels as numbers.
 * @type {{[p: string]: number}}
 */
const LEVELS = {
  [LOG_LEVELS.DEBUG]: 0,
  [LOG_LEVELS.INFO]: 1,
  [LOG_LEVELS.WARNING]: 2,
  [LOG_LEVELS.ERROR]: 3,
}

let currentLevel = LEVELS[LOG_LEVELS.INFO]

/**
 * Logger, whose `hushed` runs an action with only errors shown and returns
 * what the action returns.
 * @type {{debug: function(string, ...*), info: function(string, ...*),
 *  warn: function(string, ...*), error: function(string, ...*),
 *  setLevel: function(string), hushed: function(function(): *): *}}
 */
const logger = {
  debug: (msg, ...args) => {
    if (currentLevel <= LEVELS[LOG_LEVELS.DEBUG]) {
      err.debug(msg, ...args)
    }
  },
  info: (msg, ...args) => {
    if (currentLevel <= LEVELS[LOG_LEVELS.INFO]) {
      err.info(msg, ...args)
    }
  },
  warn: (msg, ...args) => {
    if (currentLevel <= LEVELS[LOG_LEVELS.WARNING]) {
      err.warning(msg, ...args)
    }
  },
  error: (msg, ...args) => err.error(msg, ...args),
  setLevel: (level) => {
    level = level.toLowerCase()
    if (!Object.hasOwn(LEVELS, level)) {
      logger.warn(
        [
          'The incorrect option --log-level provided: "%s".',
          'Possible options are %s. The default log level "info" is set',
        ].join(' '),
        level,
        Object.values(LOG_LEVELS).map((lvl) => `"${lvl}"`).join(', '),
      )
    } else {
      currentLevel = LEVELS[level]
      logger.debug(`Log level set to '${level}'`)
    }
  },
  hushed: (action) => {
    const level = currentLevel
    currentLevel = LEVELS[LOG_LEVELS.ERROR]
    try {
      return action()
    } finally {
      currentLevel = level
    }
  },
}

module.exports = {
  logger,
  levels: LOG_LEVELS,
}
