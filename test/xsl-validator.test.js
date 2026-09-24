/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {validate} = require('../src/validators/xsl-validator')
const {XMLSerializer} = require('@xmldom/xmldom')
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
    name: 'should keep a stylesheet that opens on a byte order mark',
    file: 'marked.xsl',
    content: '\uFEFF<a><b/></a>',
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
    name: 'should keep a stylesheet whose entity name holds a dot',
    file: 'dotted.xsl',
    content: '<!DOCTYPE a [<!ENTITY sc.name "x">]>\n<a>&sc.name;</a>',
  },
  {
    name: 'should keep a stylesheet whose entity name holds a hyphen',
    file: 'hyphened.xsl',
    content: '<!DOCTYPE a [<!ENTITY sc-name "x">]>\n<a>&sc-name;</a>',
  },
  {
    name: 'should keep a stylesheet whose dotted entity comes from a DTD',
    file: 'inherited.xsl',
    content: [
      '<!DOCTYPE a [<!ENTITY % ent SYSTEM "e.ent"> %ent;]>\n',
      '<a>&comment.block.parents;</a>',
    ].join(''),
  },
  {
    name: 'should keep a stylesheet whose dotted entity stands in an attribute',
    file: 'valued.xsl',
    content: '<!DOCTYPE a [<!ENTITY sc.name "x">]>\n<a b="&sc.name;"/>',
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
  {
    name: 'should keep a declaration whose ampersand opens a reference',
    file: 'bound.xsl',
    content: '<a xmlns:q="urn:x&amp;y"/>',
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
    name: 'should report an ampersand that opens no reference in an attribute',
    file: 'attribute.xsl',
    content: '<a b="Tom & Jerry"/>',
  },
  {
    name: 'should report a bare ampersand standing in a later attribute',
    file: 'second.xsl',
    content: '<a b="ok" c="Tom & Jerry"/>',
  },
  {
    name: 'should report a bare ampersand in an attribute deep in the tree',
    file: 'nested.xsl',
    content: '<a><b/><c d="Tom & Jerry"/></a>',
  },
  {
    name: 'should report an ampersand whose semicolon never arrives in text',
    file: 'truncated.xsl',
    content: '<a>&amp Jerry</a>',
  },
  {
    name: 'should report an ampersand whose semicolon never arrives in a value',
    file: 'clipped.xsl',
    content: '<a b="&amp Jerry"/>',
  },
  {
    name: 'should report a stylesheet malformed behind a byte order mark',
    file: 'stamped.xsl',
    content: '\uFEFF<a><b></a>',
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
  {
    name: 'should report a bare ampersand in a namespace declaration',
    file: 'namespaced.xsl',
    content: '<a xmlns:q="urn:x&y"/>',
  },
  {
    name: 'should report a bare ampersand declaring the default namespace',
    file: 'defaulted.xsl',
    content: '<a xmlns="urn:x&y"/>',
  },
  {
    name: 'should report an unreachable entity in a namespace declaration',
    file: 'unbound.xsl',
    content: '<a xmlns:q="&nope;"/>',
  },
  {
    name: 'should report a namespace declaration standing behind an attribute',
    file: 'aside.xsl',
    content: '<a b="ok" xmlns:q="urn:x&y"/>',
  },
  {
    name: 'should report a namespace declaration deep in the tree',
    file: 'descended.xsl',
    content: '<a><b/><c xmlns:q="urn:x&y"/></a>',
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
    name: 'should expand an entity whose name holds a dot',
    content: [
      '<!DOCTYPE a [<!ENTITY lc.set "\'abc\'">]>\n',
      '<a t="translate(.,&lc.set;,X)"/>',
    ].join(''),
    expected: 'translate(.,\'abc\',X)',
  },
  {
    name: 'should expand a declared entity and leave an unresolvable one alone',
    content: [
      '<!DOCTYPE a [<!ENTITY lc \'abc\'> <!ENTITY % x SYSTEM "x.ent">]>\n',
      '<a t="&lc;-&primary;"/>',
    ].join(''),
    expected: 'abc-&primary;',
  },
]

/**
 * Sources whose entities stand in a text node, paired with the document each
 * expands into. A replacement text that spells an element is markup a parser
 * reads, never the characters a check would report as loose text, and one no
 * subset this run read declares stands for content we never saw rather than
 * for the seven characters spelling its name (#984).
 * @type {Array.<{name: string, content: string, expanded: string}>}
 */
const GRAFTED = [
  {
    name: 'should read an entity whose replacement is an element as markup',
    content: '<!DOCTYPE a [<!ENTITY mk "<b/>">]>\n<a>&mk;</a>',
    expanded: '<a><b/></a>',
  },
  {
    name: 'should keep the text standing on either side of such a reference',
    content: '<!DOCTYPE a [<!ENTITY mk "<b/>">]>\n<a>one &mk; two</a>',
    expanded: '<a>one <b/> two</a>',
  },
  {
    name: 'should place every reference one text node holds',
    content: '<!DOCTYPE a [<!ENTITY mk "<b/>">]>\n<a>&mk;&mk;</a>',
    expanded: '<a><b/><b/></a>',
  },
  {
    name: 'should read the markup in the prefixes its reference point binds',
    content: [
      '<!DOCTYPE a [<!ENTITY mk "<x:b/>">]>\n',
      '<a xmlns:x="urn:x">&mk;</a>',
    ].join(''),
    expanded: '<a xmlns:x="urn:x"><x:b/></a>',
  },
  {
    name: 'should escape what stood beside the markup rather than parse it',
    content: '<!DOCTYPE a [<!ENTITY mk "<b/>">]>\n<a>p &lt; q &mk;</a>',
    expanded: '<a>p &lt; q <b/></a>',
  },
  {
    name: 'should leave an entity whose replacement is characters as text',
    content: '<!DOCTYPE a [<!ENTITY mk "plain">]>\n<a>&mk;</a>',
    expanded: '<a>plain</a>',
  },
  {
    name: 'should read a reference no subset it reached declares as nothing',
    content: '<!DOCTYPE a SYSTEM "e.dtd">\n<a>&far;</a>',
    expanded: '<a/>',
  },
  {
    name: 'should leave the text standing around such a reference',
    content: '<!DOCTYPE a SYSTEM "e.dtd">\n<a>one &far; two</a>',
    expanded: '<a>one  two</a>',
  },
  {
    name: 'should place an attribute the markup carries where it stood',
    content: '<!DOCTYPE a [<!ENTITY mk "<b t=\'v\'/>">]>\n<a>&mk;</a>',
    expanded: '<a><b t="v"/></a>',
  },
  {
    name: 'should place what stands under what an entity brings',
    content: '<!DOCTYPE a [<!ENTITY mk "<b><c/></b>">]>\n<a>&mk;</a>',
    expanded: '<a><b><c/></b></a>',
  },
  {
    name: 'should reach a reference standing under an element of its own',
    content: '<!DOCTYPE a [<!ENTITY mk "deep">]>\n<a><b>&mk;</b></a>',
    expanded: '<a><b>deep</b></a>',
  },
  {
    name: 'should read an ampersand that was written out as itself',
    content: '<!DOCTYPE a SYSTEM "e.dtd">\n<a>&amp;far;</a>',
    expanded: '<a>&amp;far;</a>',
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
  GRAFTED.forEach(({name, content, expanded}) => {
    it(name, function() {
      assert.equal(
        new XMLSerializer().serializeToString(
          validate([{file: 'g.xsl', content}]).corpus[0].xsl.documentElement,
        ),
        expanded,
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
