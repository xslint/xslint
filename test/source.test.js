/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {character, offsetAt, placeAt, skip} = require('../src/source')
const assert = require('assert')

/**
 * Raw texts paired with what the character at an offset decodes to and where
 * the walk resumes, so the count a position is built on is pinned per spelling.
 * @type {Array.<{name: string, content: string, at: number,
 *  decoded: (string|undefined), next: number}>}
 */
const CHARACTERS = [
  {
    name: 'reads a plain character as itself',
    content: 'abc', at: 1, decoded: 'b', next: 2,
  },
  {
    name: 'reads a named entity as the one character it stands for',
    content: 'a&gt;b', at: 1, decoded: '>', next: 5,
  },
  {
    name: 'reads a CRLF line ending as the newline a parser leaves',
    content: 'a\r\nb', at: 1, decoded: '\n', next: 3,
  },
  {
    name: 'reads a lone carriage return as a newline too',
    content: 'a\rb', at: 1, decoded: '\n', next: 2,
  },
  {
    name: 'reads a newline as itself',
    content: 'a\nb', at: 1, decoded: '\n', next: 2,
  },
  {
    name: 'refuses an entity no semicolon closes',
    content: 'a&gt', at: 1, decoded: undefined, next: 2,
  },
  {
    name: 'reads a decimal character reference as the character it numbers',
    content: 'a&#65;b', at: 1, decoded: 'A', next: 6,
  },
  {
    name: 'reads a hexadecimal one as the character it numbers too',
    content: 'a&#x41;b', at: 1, decoded: 'A', next: 7,
  },
  {
    name: 'reads one above the basic plane as the pair it is held in',
    content: 'a&#128512;b', at: 1, decoded: '\u{1F600}', next: 10,
  },
  {
    name: 'refuses a reference spelling its x in capitals, as XML does',
    content: 'a&#X41;b', at: 1, decoded: undefined, next: 7,
  },
  {
    name: 'refuses a code point standing past the last one there is',
    content: 'a&#1114112;b', at: 1, decoded: undefined, next: 11,
  },
  {
    name: 'refuses an entity it does not know',
    content: 'a&nbsp;b', at: 1, decoded: undefined, next: 7,
  },
]

/**
 * Texts paired with how far a walk of the given length reaches, which is what
 * keeps a defect on the character it stands on.
 * @type {Array.<{name: string, content: string, count: number, raw: number}>}
 */
const WALKS = [
  {
    name: 'counts a CRLF line ending as the one character it becomes',
    content: 'ab\r\ncd', count: 4, raw: 5,
  },
  {
    name: 'counts three CRLF endings as three characters',
    content: 'a\r\nb\r\nc\r\nd', count: 6, raw: 9,
  },
  {
    name: 'counts an entity as the one character it becomes',
    content: 'a&amp;b', count: 2, raw: 6,
  },
  {
    name: 'counts a plain run one for one',
    content: 'abcdef', count: 3, raw: 3,
  },
  {
    name: 'reaches an entity that sits at the very end of the span',
    content: 'ab&amp;', count: 3, raw: 7,
  },
  {
    name: 'goes nowhere for a count below zero',
    content: 'abcdef', count: -2, raw: 0,
  },
]

/**
 * The same three lines written with each line ending XML recognises, paired
 * with the offset of the third character of the second line. A parser numbers
 * lines the same way whichever is used, so a walk has to as well.
 * @type {Array.<{name: string, content: string, offset: number}>}
 */
const ENDINGS = [
  {name: 'a newline', content: 'ab\ncde\nf', offset: 5},
  {name: 'a carriage return', content: 'ab\rcde\rf', offset: 5},
  {name: 'a CRLF pair', content: 'ab\r\ncde\r\nf', offset: 6},
]

describe('source', function() {
  CHARACTERS.forEach((one) => {
    it(one.name, function() {
      assert.deepStrictEqual(
        character(one.content, one.at),
        [one.decoded, one.next],
      )
    })
  })
  WALKS.forEach((one) => {
    it(one.name, function() {
      assert.equal(skip(one.content, 0, one.count), one.raw)
    })
  })
  ENDINGS.forEach((one) => {
    it(`turns a line and column into an offset across ${one.name}`, function() {
      assert.equal(offsetAt(one.content, 2, 3), one.offset)
    })
    it(`turns that offset back into a line and column across ${one.name}`,
      function() {
        assert.deepStrictEqual(
          placeAt(one.content, one.offset), {line: 2, pos: 3},
        )
      })
  })
})
