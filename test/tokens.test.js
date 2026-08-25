/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {tokenized, qualified, TOKENS} = require('../src/tokens')
const assert = require('assert')

/**
 * Cases where each input yields a first NUMBER token of an expected value.
 * @type {Array.<{name: string, inputs: Array.<string>,
 *  values: Array.<string>}>}
 */
const NUMBERS = [
  {
    name: 'checks the correct value of number with whitespaces around',
    inputs: ['w 123 q', 'w 123.1 q', 'w .1 q', 'w 123. q', 'w 1.5e10 q',
      'w 123e-45 q'],
    values: ['123', '123.1', '.1', '123.', '1.5e10', '123e-45'],
  },
  {
    name: 'checks the incorrect value of number with no whitespaces around',
    inputs: ['123.45.6', '123e45E6', '123e45.6', '1e', '1e+'],
    values: ['123.45', '123e45', '123e45', '1', '1'],
  },
]

/**
 * Cases where each input holds `count` tokens of the paired type.
 * @type {Array.<{name: string, count: number,
 *  pairs: Array.<[string, string]>}>}
 */
const SCANS = [
  {
    name: 'finds brackets and parentheses',
    count: 1,
    pairs: [
      ['( w e', TOKENS.LPAREN],
      ['w ) e', TOKENS.RPAREN],
      ['w [ e', TOKENS.LBRACKET],
      ['t t ]', TOKENS.RBRACKET],
    ],
  },
  {
    name: 'gives the path punctuation a kind of its own',
    count: 1,
    pairs: [
      ['a/b', TOKENS.SLASH],
      ['a//b', TOKENS.DOUBLE_SLASH],
      ['@id', TOKENS.AT],
      ['$var', TOKENS.DOLLAR],
      ['f(x, y)', TOKENS.COMMA],
      ['a[.]', TOKENS.DOT],
      ['a/..', TOKENS.DOUBLE_DOT],
      ['foo ::bar', TOKENS.COLONS],
      ['foo::bar', TOKENS.COLONS],
      ['a:b::c', TOKENS.COLONS],
      ['child::a::b', TOKENS.COLONS],
      ['$v::a', TOKENS.COLONS],
      ['namespace-node::a', TOKENS.COLONS],
    ],
  },
  {
    name: 'cannot read punctuation out of a token that spells it',
    count: 0,
    pairs: [
      ['.5', TOKENS.DOT],
      ['a.', TOKENS.DOT],
      ['child::a', TOKENS.COLONS],
      ['a//b', TOKENS.SLASH],
      ['a/..', TOKENS.DOT],
    ],
  },
  {
    name: 'reads a word behind the context item as the operator it spells',
    count: 1,
    pairs: [
      ['. or x', TOKENS.OR],
      ['.. and x', TOKENS.AND],
      ['a/.. union b', TOKENS.UNION],
    ],
  },
  {
    name: 'keeps a name whole around the operator letters inside it',
    count: 1,
    pairs: [
      ['border', TOKENS.NAME],
      ['agent', TOKENS.NAME],
      ['grandchild', TOKENS.NAME],
      ['modal', TOKENS.NAME],
      ['unionist', TOKENS.NAME],
      ['exception', TOKENS.NAME],
      ['orange', TOKENS.NAME],
      ['a-child', TOKENS.NAME],
      ['instanceof', TOKENS.NAME],
    ],
  },
  {
    name: 'reads a word as a name where no operator may stand',
    count: 3,
    pairs: [
      ['union w e', TOKENS.NAME],
      ['or w e', TOKENS.NAME],
      ['a/or/b', TOKENS.NAME],
    ],
  },
  {
    name: 'lexes a node comparison as the one operator it is',
    count: 1,
    pairs: [
      ['$a is $b', TOKENS.IS],
      ['$a << $b', TOKENS.PRECEDES],
      ['$a >> $b', TOKENS.FOLLOWS],
      ['a[$v << .]', TOKENS.PRECEDES],
      ['f($a is $b, 2)', TOKENS.IS],
      ['not($a >> $b) and c', TOKENS.FOLLOWS],
    ],
  },
  {
    name: 'lexes every node comparison an expression holds',
    count: 3,
    pairs: [
      ['$a is $b or $c is $d or $e is $f', TOKENS.IS],
      ['$a << $b and $c << $d and $e << $f', TOKENS.PRECEDES],
      ['$a >> $b and $c >> $d and $e >> $f', TOKENS.FOLLOWS],
    ],
  },
  {
    name: 'leaves a single angle bracket the comparison it spells',
    count: 1,
    pairs: [
      ['$a < $b', TOKENS.LESS],
      ['$a <= $b', TOKENS.LESS_EQUAL],
      ['$a > $b', TOKENS.GREATER],
      ['$a >= $b', TOKENS.GREAT_EQUAL],
    ],
  },
  {
    name: 'reads a name spelled like a node comparison as a node test',
    count: 0,
    pairs: [
      ['is', TOKENS.IS],
      ['foo/is', TOKENS.IS],
      ['@is', TOKENS.IS],
      ['a[is]', TOKENS.IS],
      ['is(3)', TOKENS.IS],
      ['island', TOKENS.IS],
      ['child::is', TOKENS.IS],
    ],
  },
  {
    name: 'gives the operators XSLT 3.1 added a kind of their own',
    count: 1,
    pairs: [
      ['a => upper-case()', TOKENS.ARROW],
      ['let $sum := 1 return $sum', TOKENS.ASSIGN],
      ['$seq!name()', TOKENS.SIMPLE_MAP],
      ['abs#1', TOKENS.HASH],
      ['$map?width', TOKENS.LOOKUP],
      ['map{"aa":1}', TOKENS.LBRACE],
      ['map{"aa":1}', TOKENS.RBRACE],
      ['map{"aa":1}', TOKENS.COLON],
    ],
  },
  {
    name: 'ends a name at a colon no name can follow',
    count: 1,
    pairs: [
      ['map{a: 1}', TOKENS.COLON],
      ['map{a:1}', TOKENS.COLON],
      ['map{my:a: 1}', TOKENS.COLON],
      ['map{a/b: 1}', TOKENS.COLON],
      ['my:*', TOKENS.COLON],
      ['my:25l', TOKENS.COLON],
      ['a:', TOKENS.COLON],
      ['my:a:b', TOKENS.COLON],
    ],
  },
  {
    name: 'runs a name on through the colon of a prefix',
    count: 1,
    pairs: [
      ['my:a', TOKENS.NAME],
      ['my:_x', TOKENS.NAME],
      ['my:ä', TOKENS.NAME],
      ['my:a·b', TOKENS.NAME],
    ],
  },
  {
    name: 'takes an extender for a name character',
    count: 1,
    pairs: [
      ['a\u00B7b', TOKENS.NAME],
      ['a\u203Fb', TOKENS.NAME],
      ['a\u2040b', TOKENS.NAME],
      ['my:a\u00B7b', TOKENS.NAME],
      ['@a\u00B7b', TOKENS.NAME],
    ],
  },
  {
    name: 'lexes a braced URI literal whole',
    count: 1,
    pairs: [
      ['Q{urn:my}a', TOKENS.URI],
      ['Q{}a', TOKENS.URI],
      ['Q{ urn:my }a', TOKENS.URI],
      ['Q{urn:my}*', TOKENS.URI],
      ['a/Q{urn:my}b', TOKENS.URI],
      ['$Q{urn:my}v', TOKENS.URI],
      ['Q{urn:my}fn(1)', TOKENS.URI],
    ],
  },
  {
    name: 'reads no braced URI literal where none is spelled',
    count: 0,
    pairs: [
      ['map{"aa":1}', TOKENS.URI],
      ['aQ{urn:my}b', TOKENS.URI],
      ['Q{unclosed', TOKENS.URI],
      ['Q{a{b}c', TOKENS.URI],
      ['Q:a', TOKENS.URI],
      ['Q', TOKENS.URI],
      ['Qa', TOKENS.URI],
    ],
  },
  {
    name: 'leaves the brace of a map constructor to the map',
    count: 1,
    pairs: [
      ['map{"aa":1}', TOKENS.LBRACE],
      ['Q{urn:my}a[map{"aa":1}]', TOKENS.LBRACE],
    ],
  },
  {
    name: 'refuses to call a literal that never closes a string',
    count: 1,
    pairs: [
      ['\'unclosed', TOKENS.UNCLOSED],
      ['"unclosed', TOKENS.UNCLOSED],
      ['\'', TOKENS.UNCLOSED],
      ['concat(\'a\', \'b', TOKENS.UNCLOSED],
      ['\'closed\' + \'unclosed', TOKENS.UNCLOSED],
      ['\'a\'\'b', TOKENS.UNCLOSED],
    ],
  },
  {
    name: 'refuses to call a comment that never closes a comment',
    count: 1,
    pairs: [
      ['a (: b', TOKENS.UNCLOSED],
      ['(:', TOKENS.UNCLOSED],
      ['a (: b : )', TOKENS.UNCLOSED],
      ['(: outer (: inner :)', TOKENS.UNCLOSED],
      ['(: c :) + (: d', TOKENS.UNCLOSED],
    ],
  },
  {
    name: 'cannot read a comment out of the bracket that opens one',
    count: 0,
    pairs: [
      ['a (: b', TOKENS.COMMENT],
      ['a (: b : )', TOKENS.COMMENT],
      ['(: outer (: inner :)', TOKENS.COMMENT],
      ['(: c :)', TOKENS.UNCLOSED],
      ['(: (:n:) :)', TOKENS.UNCLOSED],
    ],
  },
  {
    name: 'keeps a literal that does close a string, doubled quote and all',
    count: 1,
    pairs: [
      ['\'a\'', TOKENS.STRING],
      ['""', TOKENS.STRING],
      ['\'\'', TOKENS.STRING],
      ['\'a\'\'b\'', TOKENS.STRING],
      ['\'closed\' + \'unclosed', TOKENS.STRING],
      ['"it\'s"', TOKENS.STRING],
    ],
  },
  {
    name: 'cannot read a literal out of the quote that opens one',
    count: 0,
    pairs: [
      ['\'unclosed', TOKENS.STRING],
      ['"unclosed', TOKENS.STRING],
      ['\'a\'\'b', TOKENS.STRING],
      ['\'a\'', TOKENS.UNCLOSED],
      ['\'a\'\'b\'', TOKENS.UNCLOSED],
    ],
  },
  {
    name: 'cannot read an operator behind the colon that spells a name',
    count: 0,
    pairs: [
      ['aa:or', TOKENS.OR],
      ['map{"kk":or}', TOKENS.OR],
      ['child::or', TOKENS.OR],
      ['aa:or', TOKENS.COLONS],
      ['child::or', TOKENS.COLON],
    ],
  },
  {
    name: 'cannot read a comparison out of the arrow that spells one',
    count: 0,
    pairs: [
      ['a => upper-case()', TOKENS.EQUAL],
      ['a => upper-case()', TOKENS.GREATER],
      ['a=>foo()=>bar()', TOKENS.GREATER],
      ['let $sum := 1 return $sum', TOKENS.EQUAL],
      ['map{"aa":1}?aa', TOKENS.OTHER],
    ],
  },
  {
    name: 'keeps every comparison the arrow resembles',
    count: 1,
    pairs: [
      ['$xx >= 1', TOKENS.GREAT_EQUAL],
      ['aa > bb', TOKENS.GREATER],
      ['aa = bb', TOKENS.EQUAL],
      ['aa <= bb', TOKENS.LESS_EQUAL],
      ['aa != bb', TOKENS.NOT_EQUAL],
      ['aa >= bb => foo()', TOKENS.GREAT_EQUAL],
      ['aa >= bb => foo()', TOKENS.ARROW],
    ],
  },
  {
    name: 'finds every arrow of a chain, not only the first',
    count: 3,
    pairs: [
      ['aa=>foo()=>bar()=>baz()', TOKENS.ARROW],
      ['aa => foo() => bar() => baz()', TOKENS.ARROW],
      ['foo(aa=>one(), bb=>two(), cc=>three())', TOKENS.ARROW],
    ],
  },
  {
    name: 'finds operators',
    count: 1,
    pairs: [
      ['+ w e', TOKENS.PLUS],
      ['w -e', TOKENS.MINUS],
      ['w 7*', TOKENS.MULTI],
      ['t = t', TOKENS.EQUAL],
      ['!= w e', TOKENS.NOT_EQUAL],
      ['t eq t', TOKENS.EQ],
      ['2 div 7', TOKENS.DIV],
      ['w union e', TOKENS.UNION],
      ['w intersect e', TOKENS.INTERSECT],
    ],
  },
  {
    name: 'finds axes',
    count: 1,
    pairs: [
      ['child::abc', TOKENS.CHILD],
      ['descendant-or-self::def', TOKENS.DESCENDANT_OR_SELF],
      ['attribute::ghi', TOKENS.ATTRIBUTE],
    ],
  },
  {
    name: 'finds an axis with whitespace before the colons',
    count: 1,
    pairs: [
      ['child ::abc', TOKENS.CHILD],
      ['namespace ::*', TOKENS.NAMESPACE],
      ['attribute\t::ghi', TOKENS.ATTRIBUTE],
      ['descendant-or-self\n::def', TOKENS.DESCENDANT_OR_SELF],
    ],
  },
  {
    name: 'finds an axis that opens a step after an operator',
    count: 1,
    pairs: [
      ['count(a)-child::b', TOKENS.CHILD],
      ['1-child::b', TOKENS.CHILD],
      ['count(a) - child::b', TOKENS.CHILD],
      ['a|self::b', TOKENS.SELF],
    ],
  },
  {
    name: 'finds no axes',
    count: 0,
    pairs: [
      ['child:abc', TOKENS.CHILD],
      ['descendant-or-self', TOKENS.DESCENDANT_OR_SELF],
      ['child : :abc', TOKENS.CHILD],
      ['ns:child::abc', TOKENS.CHILD],
      ['myself::abc', TOKENS.SELF],
      ['stepparent::abc', TOKENS.PARENT],
      ['grandchild::abc', TOKENS.CHILD],
      ['a-child::abc', TOKENS.CHILD],
      ['item2child::abc', TOKENS.CHILD],
      ['x1self::abc', TOKENS.SELF],
      ['ornamespace::x', TOKENS.NAMESPACE],
      ['exceptnamespace::x', TOKENS.NAMESPACE],
      ['h1namespace::x', TOKENS.NAMESPACE],
      ['$var-child::b', TOKENS.CHILD],
    ],
  },
]

/**
 * Expressions whose axis separator stands against a name, each paired with the
 * same expression spelling a gap beside the separator. XPath lets the gap
 * stand either side, so the two spell one thing and must arrive as one stream
 * of kinds — the kinds and not the values, an axis token folding the gap in
 * front of its own `::` and so carrying it either way.
 * @type {Array.<Array.<string>>}
 */
const SPACED = [
  ['a::b', 'a ::b'],
  ['foo::bar', 'foo ::bar'],
  ['a:b::c', 'a:b ::c'],
  ['namespace-node::a', 'namespace-node ::a'],
  ['child::a::b', 'child::a ::b'],
  ['child::child::b', 'child:: child::b'],
  ['descendant::descendant::b', 'descendant:: descendant::b'],
  ['self::self::*', 'self:: self::*'],
]

/**
 * Expressions running a word operator against the terminal in front of it,
 * where XPath requires a gap and this lexer let one be spelled without: a
 * numeric literal beside a word is a pair that cannot delimit itself, so `1div
 * 2` is a syntax error where `1 div 2` is not (#742). It is the mirror of
 * {@link SPACED}, where a gap changes nothing at all.
 * @type {Array.<string>}
 */
const GLUED = [
  '1div 2', '1and b', '1or b', '1eq 2', '1mod 2', '1idiv 2', '1union b',
  '1intersect b', '1except b', '1is b', '1.5div 2', '1.5le 2',
]

/**
 * Names, and whether XML can spell each one. A name reaches the lexer whole
 * and greedily, so what it holds is not what XML admits: the classes take a
 * colon, a digit and a hyphen anywhere where a QName takes them only where XML
 * says. The leading colon and the empty name are asked directly, no expression
 * reaching this question carrying either.
 * @type {Array.<{name: string, spells: boolean}>}
 */
const QUALIFIED = [
  {name: 'a', spells: true},
  {name: 'my:a', spells: true},
  {name: '_x', spells: true},
  {name: 'a-b', spells: true},
  {name: 'a.b', spells: true},
  {name: 'my:a-b', spells: true},
  {name: 'ä', spells: true},
  {name: 'my:ä', spells: true},
  {name: 'a·b', spells: true},
  {name: 'a‿b', spells: true},
  {name: 'a·', spells: true},
  {name: '', spells: false},
  {name: ':a', spells: false},
  {name: ':', spells: false},
  {name: '·a', spells: false},
  {name: 'my:', spells: false},
  {name: 'a:', spells: false},
  {name: 'my:25l', spells: false},
  {name: 'my:-x', spells: false},
  {name: 'my:.x', spells: false},
  {name: 'my:a:b', spells: false},
  {name: '25l', spells: false},
  {name: '-x', spells: false},
  {name: '.x', spells: false},
]

/**
 * Fragments assembled into random expressions for the round-trip properties.
 * @type {Array.<string>}
 */
const PIECES = [
  'a', 'ns:n', '"x"', '\'a\'\'b\'', '(: c :)', '(: (:n:) :)', '123', '4.5',
  '.5', '1e3', 'child::', 'descendant-or-self::', '@', ' ', '  ', '\t',
  '\n', '//', '/', '(', ')', '[', ']', '*', '+', '-', '=', '!=', '<=',
  '>=', '|', '||', 'and', 'or', 'div', 'mod', 'instance of', '$v', ',', ':',
  '.', '..', '::', '!', '?', '#', '=>', ':=', '{', '}', 'let ', ' return ',
  '<<', '>>', ' is ', 'Q{urn:my}', 'Q{}',
]

/**
 * A random expression built from one to twelve pieces.
 * @return {string} - The generated expression
 */
const generated = function() {
  let expression = ''
  const parts = 1 + Math.floor(Math.random() * 12)
  for (let part = 0; part < parts; part += 1) {
    expression += PIECES[Math.floor(Math.random() * PIECES.length)]
  }
  return expression
}

describe('tokens', function() {
  it('tokenizes a run of spaces as one whitespace token', function() {
    assert.equal(
      tokenized('a  b').find((token) => token.type === TOKENS.WHITESPACE).value,
      '  ',
    )
  })
  it('records the offset where a token starts', function() {
    assert.equal(
      tokenized('a  b').find((token) => token.type === TOKENS.WHITESPACE).start,
      1,
    )
  })
  it('keeps the whitespace before the colons inside an axis token value', function() {
    assert.equal(
      tokenized('child ::x').find((token) => token.type === TOKENS.CHILD).value,
      'child ::',
    )
  })
  SPACED.forEach(([tight, spaced]) => {
    it(`reads ${tight} as the kinds ${spaced} reads`, function() {
      assert.deepEqual(
        tokenized(tight).map((token) => token.type),
        tokenized(spaced)
          .map((token) => token.type)
          .filter((kind) => kind !== TOKENS.WHITESPACE),
        `${tight} and ${spaced} spell one expression and arrive as two`,
      )
    })
  })
  GLUED.forEach((xpath) => {
    it(`reads the word run against the literal of ${xpath} as a name`, () => {
      assert.equal(
        tokenized(xpath).filter((token) => token.type !== TOKENS.WHITESPACE)[1]
          .type,
        TOKENS.NAME,
        `${xpath} runs two terminals together that XPath makes a gap stand ` +
          'between, and the word behind the literal arrived an operator',
      )
    })
  })
  it('keeps a string literal whole despite the spaces inside it', function() {
    assert.ok(
      tokenized('"a  b"').every((token) => token.type !== TOKENS.WHITESPACE),
    )
  })
  it('keeps a comment whole despite the spaces inside it', function() {
    assert.ok(
      tokenized('(: a  b :)').every((token) => token.type !== TOKENS.WHITESPACE),
    )
  })
  it('treats doubled quotes inside a literal as an escape', function() {
    assert.equal(tokenized('"a""b"').length, 1)
  })
  it('records the offset where a number starts', function() {
    assert.equal(
      tokenized('$a + 12').find((token) => token.type === TOKENS.NUMBER).start,
      5,
    )
  })
  NUMBERS.forEach(({name, inputs, values}) => {
    it(name, function() {
      inputs.forEach((string, index) => {
        assert.equal(
          tokenized(string).find((token) => token.type === TOKENS.NUMBER).value,
          values[index],
        )
      })
    })
  })
  SCANS.forEach(({name, count, pairs}) => {
    it(name, function() {
      pairs.forEach(([string, type]) => {
        assert.equal(
          tokenized(string).filter((token) => token.type === type).length,
          count,
        )
      })
    })
  })
  QUALIFIED.forEach(({name, spells}) => {
    it(`weighs ${JSON.stringify(name)} the way XML spells a name`, function() {
      assert.equal(
        qualified(name), spells,
        `${JSON.stringify(name)} is weighed the wrong way as a name`,
      )
    })
  })
  it('finds any user functions', function() {
    const VALUE = [
      'my:funct',
      'my3:funct',
      'w:foo',
      'q1r:function',
    ]
    const tokens = tokenized('my:funct() my3:funct() w:foo(e) q1r:function()')
      .filter((token) => token.type === TOKENS.USER_FUNCTION)
    tokens.forEach((token, index) => {
      assert.equal(token.value, VALUE[index])
    })
  })
  it('finds no user functions', function() {
    assert.ok(
      tokenized('foo(e) q1r:function q1r::function 3:funct() funct:()').filter((token) => token.type === TOKENS.USER_FUNCTION)
        .length === 0,
    )
  })
  it('reconstructs every generated expression from its tokens', function() {
    for (let count = 0; count < 500; count += 1) {
      const expression = generated()
      assert.equal(
        tokenized(expression).map((token) => token.value).join(''),
        expression,
      )
    }
  })
  it('leaves none of the punctuation XPath names in the residue', function() {
    for (let count = 0; count < 500; count += 1) {
      const expression = generated()
      assert.deepEqual(
        tokenized(expression)
          .filter((token) => token.type === TOKENS.OTHER)
          .map((token) => token.value)
          .filter((value) => /[/@$,.!?#{}:]/u.test(value)),
        [],
        `${expression} lexes path punctuation into an undivided residue run`,
      )
    }
  })
  it('positions generated expression tokens at contiguous offsets', function() {
    for (let count = 0; count < 500; count += 1) {
      const expression = generated()
      let offset = 0
      for (const token of tokenized(expression)) {
        assert.equal(token.start, offset)
        assert.ok(token.value.length > 0)
        offset += token.value.length
      }
    }
  })
})
