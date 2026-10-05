# Can use abbreviated axis specifier

XPath gives its four commonest steps two spellings each, and a codebase that
mixes them makes every reader stop at a longhand to ask what it means that the
short form would not. In an expression the answer is nothing:
`child::chapter/child::section/attribute::id` selects exactly what
`chapter/section/@id` selects. Meanwhile a search for `@id` misses the
longhand, and a reviewer used to one spelling reads past the other. Keeping to
one spelling settles the question, and the short forms are the one to keep,
being the idiom nearly all XSLT is already written in. A team that spells
`child::` out on purpose, for emphasis, turns this check off and keeps to the
longhand throughout.

The abbreviations are defined by XPath itself and select precisely the same
nodes as the longhand — in an expression. A `match` is not an expression but a
pattern, a narrower grammar with its own rules about where `.` may stand and its
own way of deciding which template wins, so the table below is about `select`
and `test`, and a pattern is discussed at the end:

| Longhand | Short |
| --- | --- |
| `child::name` | `name` |
| `attribute::name` | `@name` |
| `parent::node()` | `..` |
| `self::node()` | `.` |

Incorrect:

```xsl
<xsl:value-of select="child::title"/>
<xsl:value-of select="attribute::name"/>
<xsl:apply-templates select="parent::node()"/>
<xsl:copy-of select="self::node()"/>
<xsl:value-of select="child::book/child::author/attribute::id"/>
```

Correct:

```xsl
<xsl:value-of select="title"/>
<xsl:value-of select="@name"/>
<xsl:apply-templates select=".."/>
<xsl:copy-of select="."/>
<xsl:value-of select="book/author/@id"/>
```

Those four are the whole of the trade. `parent::chapter` and `self::chapter`
name an element rather than any node at all, so they have no shorter spelling
and stay as they are, and the remaining axes — `descendant::`, `ancestor::`,
`following-sibling::` and the rest — were never given one.

The node-sets match, but the grammars do not quite, and on XSLT 1.0 that shows.
There `.` and `..` are an *abbreviated step*, a production that takes no
predicate, while the longhand is a full step and a full step accepts them. So
`self::node()[1]` is legal in a 1.0 stylesheet and `.[1]` is a syntax error in
it — XPath 2.0 gave the context item its own predicate list and lifted the
restriction, which is why the same expression compiles under a later `version`.
Where a predicate follows the step in a 1.0 stylesheet, either leave it spelled
out or parenthesise the abbreviation, since `(.)[1]` is a filter expression and
is legal in every version.

In a pattern only the first two rows hold, and not by coincidence. Before 3.0 a
pattern step admits the child and attribute axes and no others — a 1.0 processor
rejects `match="self::r"` outright — which is exactly the pair whose
abbreviations are safe there. XSLT 3.0 widened the step to the downward axes —
`descendant`, `self`, `descendant-or-self`, `namespace` — so `match="self::r"`
compiles on a 3.0 processor; the pair is still the pair, because those two drop
a step without touching how the rule is weighed. Every axis that reaches
elsewhere stayed out, `following::` as much as `parent::`, which is why
`parent::` never became a pattern step in any version.

Neither abbreviated step survives the trip. For `..` there is nothing to weigh:
`match="parent::node()"` is not a legal pattern in any version, so neither is
`match=".."`, and the question of shortening one into the other never arises.

`.` is the one with two eras. Before 3.0 the longhand is not a legal pattern
either, the self axis not being among the two. From 3.0 it is, and then the
short form is no synonym for it: `.` is a pattern in its own right, not a step
inside one, so it cannot stand in a union or behind a parenthesis,
`match="y|self::node()"` being legal where `match="y|."` is not; and standing
alone it is outranked by the longhand it replaced, `.` carrying a default
priority of -1 where `self::node()` carries -0.5, so the rewrite quietly hands
the node to a template that used to lose. Leave a longhand step as it is in a
`match`, a `count`, a `from`, or an `xsl:for-each-group` boundary.

`descendant-or-self::node()` is the exception that is not worth taking. Its
short form is `//`, but the two are easy to confuse in use: a `//` that opens a
`select` walks the whole document from the root on every evaluation, which is
rarely what the longhand step meant. Where the abbreviation is wanted there,
anchor it — `.//author` searches the current subtree, `//author` searches the
entire document.
