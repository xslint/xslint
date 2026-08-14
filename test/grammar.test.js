/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

const {parsed} = require('../src/grammar')
const {compiles} = require('../src/xpath')
const {insists} = require('./strictness')
const assert = require('assert')

/**
 * Expressions XPath 3.1 has, each with the kind its tree comes out rooted at.
 * Every one of them is handed to the engine as well, so a row cannot claim a
 * spelling the processor would refuse. Where the engine refuses one all the
 * same, `insists` says whether its own strictness is the reason — a spaced axis
 * separator here, `child::   alpha` — which is the accounting that replaced the
 * respelling retry #738 retired.
 * @type {Array.<{xpath: string, kind: string}>}
 */
const ACCEPTS = [
  {xpath: 'title', kind: 'step'},
  {xpath: 'text()', kind: 'step'},
  {xpath: 'comment()', kind: 'step'},
  {xpath: 'node()', kind: 'step'},
  {xpath: 'processing-instruction()', kind: 'step'},
  {xpath: 'processing-instruction(\'a\')', kind: 'step'},
  {xpath: 'processing-instruction(a)', kind: 'step'},
  {xpath: 'element()', kind: 'step'},
  {xpath: 'element(*)', kind: 'step'},
  {xpath: 'element(my:a)', kind: 'step'},
  {xpath: 'element(a, xs:string)', kind: 'step'},
  {xpath: 'element(a, xs:string?)', kind: 'step'},
  {xpath: 'element(*, xs:string)', kind: 'step'},
  {xpath: 'attribute()', kind: 'step'},
  {xpath: 'attribute(*)', kind: 'step'},
  {xpath: 'attribute(a, xs:string)', kind: 'step'},
  {xpath: 'attribute(*, xs:string)', kind: 'step'},
  {xpath: 'schema-element(my:a)', kind: 'step'},
  {xpath: 'document-node()', kind: 'step'},
  {xpath: 'document-node(element())', kind: 'step'},
  {xpath: 'document-node(element(a, xs:string))', kind: 'step'},
  {xpath: 'document-node(schema-element(a))', kind: 'step'},
  {xpath: '$v instance of map(*)', kind: 'instance'},
  {xpath: '$v instance of map(xs:string, xs:integer)', kind: 'instance'},
  {xpath: '$v instance of array(*)', kind: 'instance'},
  {xpath: '$v instance of array(xs:integer*)', kind: 'instance'},
  {xpath: '$v instance of array(node())', kind: 'instance'},
  {xpath: '$v instance of function(*)', kind: 'instance'},
  {xpath: '$v instance of function() as xs:integer', kind: 'instance'},
  {xpath: '$v instance of function(xs:integer, node()) as xs:integer',
    kind: 'instance'},
  {xpath: '$v instance of function(xs:integer*) as xs:integer?',
    kind: 'instance'},
  {xpath: '$v instance of item()*', kind: 'instance'},
  {xpath: '$v instance of map(*)?', kind: 'instance'},
  {xpath: '$v instance of element(a, xs:string?)', kind: 'instance'},
  {xpath: '$v instance of node', kind: 'instance'},
  {xpath: '$v instance of array(node)', kind: 'instance'},
  {xpath: '$v instance of map(text, xs:integer)', kind: 'instance'},
  {xpath: '$v instance of map(xs:string, item)', kind: 'instance'},
  {xpath: '$v instance of function(node) as xs:integer', kind: 'instance'},
  {xpath: '$v treat as text', kind: 'treat'},
  {xpath: '1 cast as node', kind: 'cast'},
  {xpath: '1 castable as item', kind: 'castable'},
  {xpath: '/', kind: 'path'},
  {xpath: '//*', kind: 'path'},
  {xpath: '@*', kind: 'step'},
  {xpath: 'Q{urn:my}a', kind: 'step'},
  {xpath: 'Q{}a', kind: 'step'},
  {xpath: 'Q{ urn:my }a', kind: 'step'},
  {xpath: 'Q{urn:my}*', kind: 'step'},
  {xpath: 'Q{urn:my}a[1]', kind: 'step'},
  {xpath: 'a/Q{urn:my}b', kind: 'path'},
  {xpath: '/Q{urn:my}a', kind: 'path'},
  {xpath: '//Q{urn:my}a', kind: 'path'},
  {xpath: '//Q{urn:my}*', kind: 'path'},
  {xpath: 'Q{urn:my}fn(1)', kind: 'call'},
  {xpath: 'my:fn(1)', kind: 'call'},
  {xpath: 'a/my:fn(1)', kind: 'path'},
  {xpath: '/my:fn(1)', kind: 'path'},
  {xpath: '//my:fn(1)', kind: 'path'},
  {xpath: '//my:fn(1)/b', kind: 'path'},
  {xpath: '$Q{urn:my}v', kind: 'variable'},
  {xpath: 'Q:a', kind: 'step'},
  {xpath: 'Q', kind: 'step'},
  {xpath: 'my:a-b', kind: 'step'},
  {xpath: 'my:_x', kind: 'step'},
  {xpath: 'my:a.b', kind: 'step'},
  {xpath: 'a·b', kind: 'step'},
  {xpath: 'a‿b', kind: 'step'},
  {xpath: 'my:a·b', kind: 'step'},
  {xpath: '@a·b', kind: 'step'},
  {xpath: 'a·b/c', kind: 'path'},
  {xpath: 'my:*', kind: 'step'},
  {xpath: '//my:*', kind: 'path'},
  {xpath: '$my:v', kind: 'variable'},
  {xpath: '*:name', kind: 'step'},
  {xpath: 'item', kind: 'step'},
  {xpath: 'a/item', kind: 'path'},
  {xpath: '//item', kind: 'path'},
  {xpath: 'map', kind: 'step'},
  {xpath: '$a instance of item()', kind: 'instance'},
  {xpath: '$a instance of map(*)', kind: 'instance'},
  {xpath: '$a instance of empty-sequence()', kind: 'instance'},
  {xpath: 'a/b//c', kind: 'path'},
  {xpath: 'child::a/attribute::b', kind: 'path'},
  {xpath: '../following-sibling::x', kind: 'path'},
  {xpath: 'child::                           alpha', kind: 'step'},
  {xpath: 'a:*', kind: 'step'},
  {xpath: '*:a', kind: 'step'},
  {xpath: 'a/my:*', kind: 'path'},
  {xpath: 'a/*:b', kind: 'path'},
  {xpath: 'a/Q{urn:my}*', kind: 'path'},
  {xpath: '*:a[1]', kind: 'step'},
  {xpath: 'text()', kind: 'step'},
  {xpath: 'processing-instruction("x")', kind: 'step'},
  {xpath: 'a[@b = "x"][2]', kind: 'step'},
  {xpath: '$v[position() = 1]', kind: 'filter'},
  {xpath: 'count(//a) > 0', kind: 'comparison'},
  {xpath: 'not(//a)', kind: 'call'},
  {xpath: 'concat("a", "b", "c")', kind: 'call'},
  {xpath: '(1, 2, 3)', kind: 'parenthesized'},
  {xpath: '()', kind: 'parenthesized'},
  {xpath: '-$a', kind: 'unary'},
  {xpath: '- -1', kind: 'unary'},
  {xpath: '1 + 2 * 3 - 4 div 5 mod 6', kind: 'sum'},
  {xpath: '3 idiv 2', kind: 'product'},
  {xpath: '//a union //b', kind: 'union'},
  {xpath: '//a | //b', kind: 'union'},
  {xpath: '//a intersect //b', kind: 'intersect'},
  {xpath: '//a except //b', kind: 'intersect'},
  {xpath: '$a eq $b', kind: 'value-comparison'},
  {xpath: '$a is $b', kind: 'node-comparison'},
  {xpath: '$a << $b', kind: 'node-comparison'},
  {xpath: '$a >> $b', kind: 'node-comparison'},
  {xpath: '($v << .) and @a', kind: 'and'},
  {xpath: 'a[$v is .]', kind: 'step'},
  {xpath: '@a and @b or @c', kind: 'or'},
  {xpath: 'for $x in //item return $x/@id', kind: 'for'},
  {xpath: 'for $x in //a, $y in //b return $x', kind: 'for'},
  {xpath: 'let $n := 1 return $n + 2', kind: 'let'},
  {xpath: 'some $x in //a satisfies $x/@b', kind: 'some'},
  {xpath: 'every $x in //a satisfies $x/@b = 1', kind: 'every'},
  {xpath: 'if (@a) then 1 else 2', kind: 'conditional'},
  {xpath: '$a instance of xs:string', kind: 'instance'},
  {xpath: '$a instance of element(x)*', kind: 'instance'},
  {xpath: '5 cast as xs:integer', kind: 'cast'},
  {xpath: '5 castable as xs:integer', kind: 'castable'},
  {xpath: '$a treat as node()', kind: 'treat'},
  {xpath: 'document-node(element(root))', kind: 'step'},
  {xpath: '1 to 10', kind: 'range'},
  {xpath: '"a" || "b"', kind: 'concat'},
  {xpath: '//a ! string()', kind: 'simple-map'},
  {xpath: '$name => upper-case()', kind: 'arrow'},
  {xpath: '$a => fn:concat("x", "y")', kind: 'arrow'},
  {xpath: 'map {"a": 1, "b": 2}', kind: 'map'},
  {xpath: 'map {}', kind: 'map'},
  {xpath: 'map{a: 1}', kind: 'map'},
  {xpath: 'map{a:1}', kind: 'map'},
  {xpath: 'map{a : 1}', kind: 'map'},
  {xpath: 'map{@a: 1}', kind: 'map'},
  {xpath: 'map{$v: 1}', kind: 'map'},
  {xpath: 'map{my:a: 1}', kind: 'map'},
  {xpath: 'map{a/b: 1}', kind: 'map'},
  {xpath: 'map{*:a: 1}', kind: 'map'},
  {xpath: 'map{Q{urn:my}a: 1}', kind: 'map'},
  {xpath: 'map{a: 1, b: 2}', kind: 'map'},
  {xpath: 'map{*: 1}', kind: 'map'},
  {xpath: 'array {1, 2}', kind: 'array'},
  {xpath: 'array {}', kind: 'array'},
  {xpath: '[1, 2, 3]', kind: 'array'},
  {xpath: '[]', kind: 'array'},
  {xpath: 'map{"aa":1}?aa', kind: 'lookup'},
  {xpath: 'map{"aa":1}?*', kind: 'lookup'},
  {xpath: '[1, 2]?1', kind: 'lookup'},
  {xpath: '[[1]]?(1)', kind: 'lookup'},
  {xpath: '?name', kind: 'lookup'},
  {xpath: 'abs#1', kind: 'reference'},
  {xpath: 'function ($x) { $x + 1 }', kind: 'inline'},
  {xpath: 'function () { 1 }', kind: 'inline'},
  {xpath: 'function () as xs:integer { 1 }', kind: 'inline'},
  {xpath: 'function ($x as xs:integer) as xs:integer { $x }', kind: 'inline'},
  {xpath: '$f(1, 2)', kind: 'apply'},
  {xpath: '(a|b)/c', kind: 'path'},
  {xpath: '//(a|b)', kind: 'path'},
  {xpath: 'x/(a|b)', kind: 'path'},
  {xpath: '//(xsl:variable | xsl:param)[not(@name)]', kind: 'path'},
  {xpath: '//xsl:number/(@count | @from)', kind: 'path'},
  {xpath: 'a/.', kind: 'path'},
  {xpath: '/.', kind: 'path'},
  {xpath: '//.', kind: 'path'},
  {xpath: '/./a', kind: 'path'},
  {xpath: '/.//a', kind: 'path'},
  {xpath: 'a/$v', kind: 'path'},
  {xpath: '.', kind: 'context'},
  {xpath: './a', kind: 'path'},
  {xpath: 'function ($x, $y) { $x }', kind: 'inline'},
  {xpath: '$a => $f()', kind: 'arrow'},
  {xpath: '$a => (function ($x) { $x })()', kind: 'arrow'},
  {xpath: 'concat("a", ?)', kind: 'call'},
  {xpath: '$a, $b', kind: 'sequence'},
  {xpath: '  @a  ', kind: 'step'},
  {xpath: '(: leading :) @a', kind: 'step'},
  {xpath: 'text() + 1', kind: 'sum'},
  {xpath: 'element(x) * 2', kind: 'product'},
  {xpath: 'a[text() + 1]', kind: 'step'},
  {xpath: 'count(text() * 2)', kind: 'call'},
  {xpath: '$v instance of (xs:integer)', kind: 'instance'},
  {xpath: '$v instance of (xs:integer)*', kind: 'instance'},
  {xpath: '$v instance of (item())+', kind: 'instance'},
  {xpath: '$v treat as (node())', kind: 'treat'},
  {xpath: '$v cast as xs:integer?', kind: 'cast'},
  {xpath: 'a ! b instance of xs:integer', kind: 'instance'},
  {xpath: '(a instance of xs:integer) ! b', kind: 'simple-map'},
  {xpath: '$v instance of xs:integer? and @b', kind: 'and'},
  {xpath: '$v instance of xs:integer+ and @b', kind: 'and'},
  {xpath: '$v instance of xs:integer* and @b', kind: 'and'},
  {xpath: '$v castable as xs:date? or @c', kind: 'or'},
  {xpath: 'a cast as xs:integer? div 2', kind: 'product'},
  {xpath: '$v treat as item()+ union b', kind: 'union'},
  {xpath: '$v instance of xs:integer? to 3', kind: 'range'},
  {xpath: '$m?div and $m?or', kind: 'and'},
  {xpath: 'count(a)div 2', kind: 'product'},
  {xpath: '"s"and b', kind: 'and'},
  {xpath: 'a[1]union b', kind: 'union'},
  {xpath: '1(: gap :)div 2', kind: 'product'},
]

/**
 * Runs of two operators XPath spells one production with, each with the text
 * the left of the two has to have folded into. One production is one rung, and
 * a rung is left-associative, so `a except b intersect c` is
 * `(a except b) intersect c` and nothing else — where a rung split in two, to
 * give one spelling a kind or a floor the other has not got, reads the second
 * operator as the looser of the two and nests the run the other way round. All
 * three of XPath's mixed rungs were split that way: the word `union` sat above
 * `|`, `idiv` above the rest of the multiplicatives, and `except` above
 * `intersect`, so `9 idiv 2 * 3` came back `9 idiv (2 * 3)` and computed 0
 * where XPath computes 12 (#764).
 * @type {Array.<{xpath: string, folds: string}>}
 */
const RUNS = [
  {xpath: 'a intersect b except c', folds: 'a intersect b'},
  {xpath: 'a except b intersect c', folds: 'a except b'},
  {xpath: 'a | b union c', folds: 'a | b'},
  {xpath: 'a union b | c', folds: 'a union b'},
  {xpath: '9 idiv 2 * 3', folds: '9 idiv 2'},
  {xpath: '9 * 2 idiv 3', folds: '9 * 2'},
  {xpath: '9 div 2 idiv 3', folds: '9 div 2'},
  {xpath: '9 idiv 2 mod 3', folds: '9 idiv 2'},
  {xpath: '9 + 2 - 3', folds: '9 + 2'},
  {xpath: '9 - 2 + 3', folds: '9 - 2'},
]

/**
 * Expressions the grammar refuses, with the offset the complaint has to point
 * at. A refusal that lands on the wrong character is the failure this parser
 * exists to end, so the offset is asserted rather than merely the refusal.
 * @type {Array.<{name: string, xpath: string, at: number}>}
 */
const REFUSES = [
  {name: 'a general comparison chained onto another', xpath: 'a < b < c',
    at: 6},
  {name: 'a value comparison chained onto another', xpath: 'a eq b eq c',
    at: 7},
  {name: 'a node comparison chained onto another', xpath: 'a << b << c',
    at: 7},
  {name: 'a comparison chained onto one of another class',
    xpath: '$a is $b << $c', at: 9},
  {name: 'a lookup hanging off a step', xpath: 'a?b', at: 1},
  {name: 'an argument list hanging off a step', xpath: '@a(1)', at: 2},
  {name: 'a cast to something no atomic type names',
    xpath: '1 cast as node()', at: 10},
  {name: 'a cast whose star is a multiplication with nothing behind it',
    xpath: '1 cast as xs:integer*', at: 21},
  {name: 'a simple map applied to what a type stands behind',
    xpath: 'a instance of xs:integer ! b', at: 25},
  {name: 'a sequence type with no item type in it',
    xpath: '$v instance of ()', at: 16},
  {name: 'a step that names no axis', xpath: 'child::', at: 7},
  {name: 'a bracket that never closes', xpath: 'count(//a', at: 9},
  {name: 'a predicate that never closes', xpath: 'a[1', at: 3},
  {name: 'an operator with nothing behind it', xpath: '1 +', at: 3},
  {name: 'a variable with no name', xpath: '$', at: 1},
  {name: 'a conditional missing its else', xpath: 'if (1) then 2', at: 13},
  {name: 'a binding missing its return', xpath: 'for $x in 1', at: 11},
  {name: 'a let missing its value', xpath: 'let $x 1 return $x', at: 7},
  {name: 'a quantifier missing satisfies', xpath: 'some $x in 1', at: 12},
  {name: 'a map entry missing its value', xpath: 'map {"a"}', at: 8},
  {name: 'a cast missing its as', xpath: '1 cast xs:integer', at: 7},
  {name: 'a prefix with nothing behind it', xpath: 'a:', at: 1},
  {name: 'a variable named by a bare prefix', xpath: '$my:', at: 3},
  {name: 'a call named by a bare prefix', xpath: 'my:(1)', at: 2},
  {name: 'text left over at the end', xpath: '@a @b', at: 3},
  {name: 'nothing at all', xpath: '', at: 0},
  {name: 'nothing but a gap', xpath: ' ', at: 1},
  {name: 'nothing but a comment', xpath: '(: c :)', at: 7},
  {name: 'a kind test that never closes', xpath: 'element(x', at: 9},
  {name: 'a function reference with no arity', xpath: 'abs#x', at: 4},
  {name: 'a literal that never closes', xpath: '\'unclosed', at: 0},
  {name: 'a comment that never closes', xpath: 'a (: b', at: 2},
  {name: 'a comment whose colon a gap parts from its bracket',
    xpath: 'a (: b : )', at: 2},
  {name: 'a comment that never closes inside a call', xpath: 'f((: a', at: 2},
  {name: 'a comment that closes only the inner one of two',
    xpath: 'a (: outer (: inner :)', at: 2},
  {name: 'a literal that never closes inside a call', xpath: 'f(\'a', at: 2},
  {name: 'an inline namespace with no name behind it', xpath: 'Q{urn:my}',
    at: 9},
  {name: 'an inline namespace behind a name', xpath: 'a Q{urn:my}b', at: 2},
  {name: 'a braced URI literal that never closes', xpath: 'Q{unclosed', at: 1},
  {name: 'a braced URI literal holding a brace', xpath: 'Q{a{b}c', at: 1},
  {name: 'a local part opening with a digit', xpath: 'my:25l', at: 2},
  {name: 'a name opening with an extender', xpath: '·a', at: 0},
  {name: 'a call whose local part opens with a digit', xpath: 'my:25l(3)',
    at: 0},
  {name: 'a local part opening with a hyphen', xpath: 'my:-x', at: 2},
  {name: 'a local part opening with a dot', xpath: 'my:.x', at: 2},
  {name: 'a name two colons split', xpath: 'my:a:b', at: 4},
  {name: 'an unspellable name behind a separator', xpath: 'a/my:25l',
    at: 4},
  {name: 'a prefixed name behind an inline namespace',
    xpath: 'Q{urn:my}a:b', at: 9},
  {name: 'an argument in a text test', xpath: 'text(a)', at: 5},
  {name: 'an argument in a comment test', xpath: 'comment(a)', at: 8},
  {name: 'an argument in an any-kind test', xpath: 'node(a)', at: 5},
  {name: 'a variable in an any-kind test', xpath: 'node($v)', at: 5},
  {name: 'an argument in a namespace-node test',
    xpath: 'namespace-node(a)', at: 15},
  {name: 'two arguments in a text test', xpath: 'text(1, 2)', at: 5},
  {name: 'a literal in a comment test', xpath: 'comment("x")', at: 8},
  {name: 'a number where an element test names an element',
    xpath: 'element(1)', at: 8},
  {name: 'a lookup where an element test names an element',
    xpath: 'element(?)', at: 8},
  {name: 'two names an element test does not separate',
    xpath: 'element(a b)', at: 10},
  {name: 'an occurrence indicator on an element test type',
    xpath: 'element(a, xs:string*)', at: 20},
  {name: 'a wildcard where an element test spells a type',
    xpath: 'element(a, *)', at: 11},
  {name: 'a second type in an element test',
    xpath: 'element(a, xs:string, xs:integer)', at: 20},
  {name: 'a nillable attribute test', xpath: 'attribute(a, xs:string?)',
    at: 22},
  {name: 'a schema element test naming nothing', xpath: 'schema-element()',
    at: 15},
  {name: 'a schema element test naming a wildcard',
    xpath: 'schema-element(*)', at: 15},
  {name: 'a schema attribute test naming nothing',
    xpath: 'schema-attribute()', at: 17},
  {name: 'a text test inside a document test',
    xpath: 'document-node(text())', at: 14},
  {name: 'a name inside a document test', xpath: 'document-node(a)', at: 14},
  {name: 'a document test inside a document test',
    xpath: 'document-node(document-node())', at: 14},
  {name: 'a prefixed name in a processing-instruction test',
    xpath: 'processing-instruction(my:a)', at: 23},
  {name: 'a number in a processing-instruction test',
    xpath: 'processing-instruction(1)', at: 23},
  {name: 'a second argument in a processing-instruction test',
    xpath: 'processing-instruction(a, b)', at: 24},
  {name: 'a map test with a key and no value',
    xpath: '$v instance of map(xs:string)', at: 28},
  {name: 'a map test keyed on a kind test',
    xpath: '$v instance of map(node(), xs:integer)', at: 19},
  {name: 'a map test whose key takes an occurrence indicator',
    xpath: '$v instance of map(xs:string?, xs:integer)', at: 28},
  {name: 'an array test of two types',
    xpath: '$v instance of array(xs:integer, xs:string)', at: 31},
  {name: 'a map test of nothing', xpath: '$v instance of map()', at: 19},
  {name: 'an array test of nothing', xpath: '$v instance of array()', at: 21},
  {name: 'an argument in an item type', xpath: '$v instance of item(a)',
    at: 20},
  {name: 'an argument in an empty-sequence type',
    xpath: '$v instance of empty-sequence(a)', at: 30},
  {name: 'a function test returning nothing',
    xpath: '$v instance of function()', at: 25},
  {name: 'a function test taking an argument and returning nothing',
    xpath: '$v instance of function(xs:integer)', at: 35},
  {name: 'an any-function test that returns',
    xpath: '$v instance of function(*) as xs:integer', at: 27},
  {name: 'an argument in a text test behind a separator',
    xpath: 'a/text(b)', at: 7},
  {name: 'an argument in a text test inside a predicate',
    xpath: 'a[text(b)]', at: 7},
  {name: 'an item type where a node test stands', xpath: 'item()', at: 0},
  {name: 'an empty sequence where a node test stands',
    xpath: 'empty-sequence()', at: 0},
  {name: 'a map test where a node test stands', xpath: 'map(*)', at: 0},
  {name: 'an array test where a node test stands', xpath: 'array(*)', at: 0},
  {name: 'a call to the reserved switch', xpath: 'switch(1)', at: 0},
  {name: 'a call to the reserved typeswitch', xpath: 'typeswitch(1)', at: 0},
  {name: 'a descendant slash with nothing to descend to', xpath: '//', at: 2},
  {name: 'a descendant slash behind a sign', xpath: '//-x', at: 2},
  {name: 'a union with a lone descendant slash', xpath: '//|a', at: 2},
  {name: 'a lone descendant slash in brackets', xpath: '(//)', at: 3},
  {name: 'an item type behind a separator', xpath: 'a/item()', at: 2},
  {name: 'an item type inside a predicate', xpath: 'a[item()]', at: 2},
  {name: 'a word operator run against the number in front of it',
    xpath: '1div 2', at: 1},
  {name: 'a word operator run against a decimal literal', xpath: '1.5mod 2',
    at: 3},
  {name: 'a two-character word operator run against a number', xpath: '1eq 2',
    at: 1},
  {name: 'a wildcard whose prefix a gap follows', xpath: 'my: *', at: 2},
  {name: 'a wildcard whose prefix a comment follows', xpath: 'my:(: c :)*',
    at: 2},
  {name: 'a wildcard prefix spaced behind a separator', xpath: 'a/my: *',
    at: 4},
  {name: 'a wildcard whose colon a gap precedes', xpath: '* :a', at: 2},
  {name: 'a wildcard whose local name a gap precedes', xpath: '*: a', at: 1},
  {name: 'a wildcard spaced on both sides of its colon', xpath: '* : a',
    at: 2},
  {name: 'a wildcard a comment stands inside', xpath: '*(: c :):a', at: 8},
  {name: 'an inline namespace a gap parts from its wildcard',
    xpath: 'Q{urn:my} *', at: 10},
  {name: 'a wildcard whose prefix stands apart from its colon',
    xpath: 'my :*', at: 3},
]

/**
 * Names a version reserved, each with the version that reserved it and one
 * below. This is the mirror of a `GATED` row: a reserved name with a bracket
 * behind it can be no call, so the expression stops parsing from that version
 * up, where a gated construct starts. Below the floor the same characters are
 * an ordinary call to a function of that name — unregistered, which is a
 * semantic question (#576) and not this parser's, and exactly what xsltproc
 * answers about every one of these at 1.0: it parses them, then looks for the
 * function.
 * @type {Array.<{xpath: string, from: string, below: string}>}
 */
const RESERVES = [
  {xpath: 'item()', from: '2.0', below: '1.0'},
  {xpath: 'if(1)', from: '2.0', below: '1.0'},
  {xpath: 'function(*)', from: '3.0', below: '2.0'},
  {xpath: 'empty-sequence()', from: '2.0', below: '1.0'},
  {xpath: 'typeswitch(1)', from: '2.0', below: '1.0'},
  {xpath: 'map(*)', from: '3.0', below: '2.0'},
  {xpath: 'array(*)', from: '3.0', below: '2.0'},
  {xpath: 'switch(1)', from: '3.0', below: '2.0'},
]

/**
 * Names whose *tree* the version in force decides, each read from both sides of
 * its floor. A kind test and a call to a function of the same name are both
 * accepted expressions, so no acceptance diff can part them and only the tree
 * can: `element(a)` is a step from 2.0 and a call at 1.0, which is what
 * xsltproc reads it as — it parses the expression and then goes looking for the
 * function. A `RESERVES` row cannot say this, since neither side is a refusal.
 * @type {Array.<{xpath: string, from: string, reads: string, below: string,
 *   instead: string}>}
 */
const SHAPED = [
  {xpath: 'element(a)', from: '2.0', reads: 'step',
    below: '1.0', instead: 'call'},
  {xpath: 'attribute(a)', from: '2.0', reads: 'step',
    below: '1.0', instead: 'call'},
  {xpath: 'document-node()', from: '2.0', reads: 'step',
    below: '1.0', instead: 'call'},
  {xpath: 'schema-element(a)', from: '2.0', reads: 'step',
    below: '1.0', instead: 'call'},
  {xpath: 'schema-attribute(a)', from: '2.0', reads: 'step',
    below: '1.0', instead: 'call'},
  {xpath: 'namespace-node()', from: '3.0', reads: 'step',
    below: '2.0', instead: 'call'},
]

/**
 * Constructs a version older than their own does not have, each with the
 * version that does. A gate is a lower bound, so the second half of each row
 * proves the construct is admitted where it belongs rather than merely refused
 * where it does not.
 * @type {Array.<{xpath: string, floor: string, below: string}>}
 */
const GATED = [
  {xpath: '1 to 10', floor: '2.0', below: '1.0'},
  {xpath: '$a instance of xs:string', floor: '2.0', below: '1.0'},
  {xpath: 'if (@a) then 1 else 2', floor: '2.0', below: '1.0'},
  {xpath: 'for $x in //a return $x', floor: '2.0', below: '1.0'},
  {xpath: 'some $x in //a satisfies $x', floor: '2.0', below: '1.0'},
  {xpath: 'every $x in //a satisfies $x', floor: '2.0', below: '1.0'},
  {xpath: '1 cast as xs:integer', floor: '2.0', below: '1.0'},
  {xpath: '1 castable as xs:integer', floor: '2.0', below: '1.0'},
  {xpath: '$a treat as node()', floor: '2.0', below: '1.0'},
  {xpath: '$a eq $b', floor: '2.0', below: '1.0'},
  {xpath: '3 idiv 2', floor: '2.0', below: '1.0'},
  {xpath: '$a is $b', floor: '2.0', below: '1.0'},
  {xpath: '$a << $b', floor: '2.0', below: '1.0'},
  {xpath: '$a >> $b', floor: '2.0', below: '1.0'},
  {xpath: 'processing-instruction(a)', floor: '2.0', below: '1.0'},
  {xpath: 'Q{urn:my}a', floor: '3.0', below: '2.0'},
  {xpath: 'Q{urn:my}*', floor: '3.0', below: '2.0'},
  {xpath: 'Q{urn:my}fn(1)', floor: '3.0', below: '2.0'},
  {xpath: '//Q{urn:my}a', floor: '3.0', below: '2.0'},
  {xpath: '//my:fn(1)', floor: '2.0', below: '1.0'},
  {xpath: '$a instance of map(*)', floor: '3.0', below: '2.0'},
  {xpath: '$a instance of array(*)', floor: '3.0', below: '2.0'},
  {xpath: 'a/element(b)', floor: '2.0', below: '1.0'},
  {xpath: '$f(1, 2)', floor: '3.0', below: '2.0'},
  {xpath: 'a/fn(1)', floor: '2.0', below: '1.0'},
  {xpath: '$Q{urn:my}v', floor: '3.0', below: '2.0'},
  {xpath: '//a intersect //b', floor: '2.0', below: '1.0'},
  {xpath: '//a except //b', floor: '2.0', below: '1.0'},
  {xpath: '//a union //b', floor: '2.0', below: '1.0'},
  {xpath: '//a ! b', floor: '3.0', below: '2.0'},
  {xpath: '$a => f()', floor: '3.0', below: '2.0'},
  {xpath: '"a" || "b"', floor: '3.0', below: '2.0'},
  {xpath: 'let $x := 1 return $x', floor: '3.0', below: '2.0'},
  {xpath: 'map {"a": 1}', floor: '3.0', below: '2.0'},
  {xpath: 'array {1}', floor: '3.0', below: '2.0'},
  {xpath: '[1]', floor: '3.0', below: '2.0'},
  {xpath: 'abs#1', floor: '3.0', below: '2.0'},
  {xpath: '?a', floor: '3.0', below: '2.0'},
  {xpath: '$m?a', floor: '3.0', below: '2.0'},
  {xpath: 'function () { 1 }', floor: '3.0', below: '2.0'},
  {xpath: 'a/(b|c)', floor: '2.0', below: '1.0'},
  {xpath: 'a//(b|c)', floor: '2.0', below: '1.0'},
  {xpath: 'a/$v', floor: '2.0', below: '1.0'},
  {xpath: 'a/1', floor: '2.0', below: '1.0'},
]

/**
 * Operators XPath 1.0 already had, each of which has to parse at the oldest
 * version there is. This is a `GATED` row from the other side: a floor claimed
 * for a construct that never had one is invisible to a table of refusals, and
 * the ladder is where that mistake lands, since `|` and `div` share a rung with
 * the `union` and `idiv` 2.0 added, so the two floors `SPELLS` carries stand a
 * table away from six that must stay absent. Nothing else can see it — no
 * committed stylesheet declaring 1.0 spells a single one of these (#764).
 * @type {Array.<string>}
 */
const ALWAYS = [
  'a | b', '9 * 2', '9 div 2', '9 mod 2', '9 + 2', '9 - 2', 'a and b',
  'a or b', 'a = b',
]

/**
 * The text a node's span slices back to, which is the property that makes a
 * span a position rather than a guess at one.
 * @param {object} answer - What `parsed` handed back
 * @param {object} node - A node of its tree
 * @return {string} - The text the node spans
 */
const sliced = function(answer, node) {
  return answer.tokens
    .slice(node.from, node.to).map((token) => token.value).join('')
}

describe('grammar', function() {
  ACCEPTS.forEach(({xpath, kind}) => {
    it(`reads ${JSON.stringify(xpath)} as a ${kind}`, function() {
      assert.equal(parsed(xpath, '3.0').tree.kind, kind)
    })
  })
  ACCEPTS.forEach(({xpath}) => {
    it(`agrees with the engine about ${JSON.stringify(xpath)}`, function() {
      assert.ok(
        compiles(xpath) || insists(xpath),
        `${xpath} is not valid XPath at all`,
      )
    })
  })
  RUNS.forEach(({xpath, folds}) => {
    it(`folds ${JSON.stringify(xpath)} left`, function() {
      const answer = parsed(xpath, '3.0')
      assert.equal(
        sliced(answer, answer.tree.children[0]), folds,
        `${xpath} is not one run of the rung both its operators stand on`,
      )
    })
  })
  REFUSES.forEach(({name, xpath, at}) => {
    it(`refuses ${name}`, function() {
      assert.deepEqual(
        [parsed(xpath, '3.0').fault === '', parsed(xpath, '3.0').at],
        [false, at],
        `${xpath} was not refused where it goes wrong`,
      )
    })
  })
  RESERVES.forEach(({xpath, from, below}) => {
    it(`reserves ${JSON.stringify(xpath)} from ${from}`, function() {
      assert.deepEqual(
        [parsed(xpath, from).fault === '', parsed(xpath, below).fault === ''],
        [false, true],
        `${xpath} is not a call below ${from} and a reserved name from it`,
      )
    })
  })
  SHAPED.forEach(({xpath, from, reads, below, instead}) => {
    const said = `reads ${JSON.stringify(xpath)} as a ${reads} only from ${from}`
    it(said, function() {
      assert.deepEqual(
        [parsed(xpath, from).tree.kind, parsed(xpath, below).tree.kind],
        [reads, instead],
        `${xpath} is not read the way ${from} and ${below} read it`,
      )
    })
  })
  GATED.forEach(({xpath, floor, below}) => {
    it(`admits ${JSON.stringify(xpath)} only from ${floor}`, function() {
      assert.deepEqual(
        [parsed(xpath, floor).fault === '', parsed(xpath, below).fault === ''],
        [true, false],
        `${xpath} is not gated at ${floor}`,
      )
    })
  })
  ALWAYS.forEach((xpath) => {
    it(`admits ${JSON.stringify(xpath)} at the oldest version`, function() {
      assert.equal(
        parsed(xpath, '1.0').fault, '',
        `${xpath} is refused by a version that has always had it`,
      )
    })
  })
  it('carries every token, trivia and all, back to the caller', function() {
    const xpath = '  @a (: why :) and  @b  '
    assert.equal(
      parsed(xpath, '3.0').tokens.map((token) => token.value).join(''),
      xpath,
      'the token stream does not reproduce the expression it came from',
    )
  })
  it('spans a node over the text it was built from', function() {
    const answer = parsed('count(//a) > 0', '3.0')
    assert.equal(
      sliced(answer, answer.tree.children[0]), 'count(//a)',
      'a span does not slice back to the text it stands for',
    )
  })
  it('spans a predicate over its own brackets', function() {
    const answer = parsed('a[@b]', '3.0')
    assert.equal(
      sliced(answer, answer.tree.children[0]), '[@b]',
      'a predicate span does not cover the predicate',
    )
  })
  it('leaves a comment out of what a step spans', function() {
    const answer = parsed('(: first :) @a', '3.0')
    assert.equal(
      sliced(answer, answer.tree), '@a',
      'a step swallowed the comment standing in front of it',
    )
  })
  it('reads a dot after a slash as a step in 1.0', function() {
    assert.equal(
      parsed('a/.', '1.0').fault, '',
      'the abbreviated step XPath 1.0 spells "." is refused after a slash',
    )
  })
  it('reads a name whose spelling is an operator as a step', function() {
    assert.equal(
      parsed('a/or', '3.0').tree.children.length, 2,
      'a name spelled like an operator was not read as a step',
    )
  })
  it('cannot swallow a bug as a refusal', function() {
    assert.throws(
      () => parsed(undefined, '3.0'),
      'an error that is not a refusal was reported as one',
    )
  })
})
