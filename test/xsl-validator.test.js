/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {validate} = require('../src/xsl-validator')
const assert = require('assert')

/**
 * Sources whose content is well-formed enough to stay in the corpus.
 * @type {Array.<{name: string, file: string, content: string}>}
 */
const KEPT = [
  {
    name: 'should keep a well-formed stylesheet in the corpus',
    file: 'good.xsl',
    content: '<a><b/></a>',
  },
  {
    name: 'should keep a stylesheet that declares an internal entity',
    file: 'declared.xsl',
    content: '<!DOCTYPE a [<!ENTITY sc "x">]>\n<a>&sc;</a>',
  },
  {
    name: 'should keep a stylesheet whose entities come from an external subset',
    file: 'external.xsl',
    content: '<!DOCTYPE a [<!ENTITY % ent SYSTEM "e.ent"> %ent;]>\n<a>&primary;</a>',
  },
  {
    name: 'should keep a stylesheet whose ampersand stands inside a comment',
    file: 'commented.xsl',
    content: '<a><!-- Tom & Jerry --></a>',
  },
  {
    name: 'should keep a stylesheet whose ampersand stands in a CDATA section',
    file: 'cdata.xsl',
    content: '<a><![CDATA[Tom & Jerry]]></a>',
  },
  {
    name: 'should keep a stylesheet whose ampersands all open a reference',
    file: 'escaped.xsl',
    content: '<a>&amp; &lt; &#38; &#x26; a&apos;b</a>',
  },
  {
    name: 'should keep a stylesheet whose section close is the only one',
    file: 'closed.xsl',
    content: '<a><![CDATA[x > y]]></a>',
  },
  {
    name: 'should keep a stylesheet whose section close stands in a comment',
    file: 'remarked.xsl',
    content: '<a><!-- ends on ]]> here --></a>',
  },
  {
    name: 'should keep a stylesheet whose section close stands in an instruction',
    file: 'instructed.xsl',
    content: '<a><?render ends on ]]> here?></a>',
  },
  {
    name: 'should keep a stylesheet whose section close stands in an attribute',
    file: 'attributed.xsl',
    content: '<a b="ends on ]]> here"/>',
  },
]

/**
 * Sources reported as malformed and left out of the corpus.
 * @type {Array.<{name: string, file: string, content: string}>}
 */
const REPORTED = [
  {
    name: 'should report a malformed stylesheet as a defect',
    file: 'broken.xsl',
    content: '<a><b></a>',
  },
  {
    name: 'should report an undefined entity as a defect',
    file: 'entity.xsl',
    content: '<a>&nope; text</a>',
  },
  {
    name: 'should report a reference to an entity the subset leaves undeclared',
    file: 'gap.xsl',
    content: '<!DOCTYPE a [<!ENTITY sc "x">]>\n<a>&other;</a>',
  },
  {
    name: 'should report an ampersand that opens no reference in text',
    file: 'ampersand.xsl',
    content: '<a>Tom & Jerry</a>',
  },
  {
    name: 'should report an ampersand that opens no reference deep in the tree',
    file: 'buried.xsl',
    content: '<a><b/><c><d>Tom & Jerry</d></c></a>',
  },
  {
    name: 'should report an ampersand beside two that open a reference',
    file: 'mixed.xsl',
    content: '<a>&amp; & &lt;</a>',
  },
  {
    name: 'should report an ampersand closing on a semicolon far downstream',
    file: 'distant.xsl',
    content: '<a>Tom & Jerry</a><!-- ; -->',
  },
  {
    name: 'should report an attribute value standing without any quotes',
    file: 'unquoted.xsl',
    content: '<a b=c/>',
  },
  {
    name: 'should report an attribute value opening on a quote it never closes',
    file: 'unclosed.xsl',
    content: '<a b=\'c"/>',
  },
  {
    name: 'should report a section close standing in text',
    file: 'orphan.xsl',
    content: '<a>x ]]> y</a>',
  },
  {
    name: 'should report a section close standing deep in the tree',
    file: 'sunken.xsl',
    content: '<a><b/><c><d>x ]]> y</d></c></a>',
  },
  {
    name: 'should report a section close beside one that truly closes',
    file: 'beside.xsl',
    content: '<a><![CDATA[x]]> ]]> y</a>',
  },
  {
    name: 'should report the first of three section closes standing in text',
    file: 'thrice.xsl',
    content: '<a>x ]]> y ]]> z ]]></a>',
  },
  {
    name: 'should report a section close a third bracket runs into',
    file: 'bracketed.xsl',
    content: '<a>x ]]]> y</a>',
  },
]

/**
 * Sources whose declared entities expand into a `t` attribute value.
 * @type {Array.<{name: string, content: string, expected: string}>}
 */
const EXPAND = [
  {
    name: 'should expand an internal entity into the parsed value',
    content: '<!DOCTYPE a [<!ENTITY lc "\'abc\'">]>\n<a t="translate(.,&lc;,X)"/>',
    expected: 'translate(.,\'abc\',X)',
  },
  {
    name: 'should expand a declared entity and leave an unresolvable one alone',
    content: '<!DOCTYPE a [<!ENTITY lc \'abc\'> <!ENTITY % x SYSTEM "x.ent">]>\n' +
      '<a t="&lc;-&primary;"/>',
    expected: 'abc-&primary;',
  },
]

describe('xsl-validator', function() {
  KEPT.forEach(({name, file, content}) => {
    it(name, function() {
      assert.equal(validate([{file, content}]).corpus[0].file, file)
    })
  })
  REPORTED.forEach(({name, file, content}) => {
    it(name, function() {
      assert.equal(
        validate([{file, content}]).defects[0].name, 'malformed-stylesheet',
      )
    })
  })
  EXPAND.forEach(({name, content, expected}) => {
    it(name, function() {
      assert.equal(
        validate([{file: 'e.xsl', content}])
          .corpus[0].xsl.documentElement.getAttribute('t'),
        expected,
      )
    })
  })
  it('should not leak parser diagnostics to the console', function() {
    const original = console.error
    const lines = []
    console.error = (...args) => lines.push(args.join(' '))
    try {
      validate([{file: 'broken.xsl', content: '<a><b></a>'}])
    } finally {
      console.error = original
    }
    assert.equal(lines.length, 0)
  })
  it('should leave a malformed stylesheet out of the corpus', function() {
    const {corpus} = validate([
      {file: 'broken.xsl', content: '<a><b></a>'},
    ])
    assert.equal(corpus.length, 0)
  })
  it('should keep only the parseable stylesheets when sources are mixed',
    function() {
      const {corpus} = validate([
        {file: 'good.xsl', content: '<a><b/></a>'},
        {file: 'broken.xsl', content: '<a><b></a>'},
      ])
      assert.equal(corpus[0].file, 'good.xsl')
    })
  it('should report one defect per malformed stylesheet when mixed',
    function() {
      const {defects} = validate([
        {file: 'good.xsl', content: '<a><b/></a>'},
        {file: 'broken.xsl', content: '<a><b></a>'},
      ])
      assert.equal(defects.length, 1)
    })
  it('should not report a malformed stylesheet when its check is suppressed',
    function() {
      const {defects} = validate(
        [{file: 'broken.xsl', content: '<a><b></a>'}],
        ['malformed-stylesheet'],
      )
      assert.equal(defects.length, 0)
    })
})
