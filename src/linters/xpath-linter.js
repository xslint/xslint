/*
 * SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
 * SPDX-License-Identifier: MIT
 */

/*
 * Loads `checks/xpath/*.yaml`; attaches any `src/fixers.js` fix, unless the
 * node — or the element carrying it — holds an expression the grammar
 * refuses (#651). The element is listed because a rule selects it while its
 * fixer reaches sideways for an attribute no gate can read; its own
 * attributes are listed with it because a rule may select the attribute
 * instead, which is what `starts-with-double-slash` did until #586 took it
 * to code, so nothing declarative selects one today and that half of the
 * set stands for the shape rather than for a rule the tree still holds. It
 * is the dearest stage there is, 39% to 50% of a run over the three corpora
 * — 42% to 56% before #811's anchor phase and 46% to 58% before its union
 * phase, those two being the moves that made the stage itself cheaper
 * rather than the denominator smaller, 39% to 44% after #784, and 49% to
 * 55% before that, all of them read the same way, as processor time over
 * the whole staged run with both validators in the divisor: read against
 * the linters alone this stage is 61% to 72% of them, a number that belongs
 * beside none of the others, and what makes it dear is the **breadth of a
 * step** rather than the number of checks: fontoxpath evaluates a
 * descendant step over an xmldom tree quadratically (#635), so a `//*` or a
 * `//xsl:*` pays for every element in the document and then filters, where
 * a `//(xsl:variable | xsl:template)` pays for the two names. Eight
 * selectors were written the broad way and are narrowed at #784 —
 * `xpath-linter` falls from 7.52 to 6.11 seconds over DocBook-XSL, 6.20 to
 * 4.90 over TEI and 2.33 to 1.82 over DITA-OT, taking the whole run down
 * 13% to 15%. Three of the eight are a *correctness* fix in the same edit,
 * which is why the narrowing is not merely a refactoring: `name()` answers
 * the lexical QName, so `//*[name() = 'xsl:variable']` asks how one
 * document happens to spell the XSLT namespace rather than anything about
 * XSLT. TEI's `rdf/make-acdc.xsl` writes its XSLT as `XSL:` and binds
 * lowercase `xsl:` to a `TransformAlias`, and `short-names` reports a
 * template there that master reads past — the false negative, one defect
 * over the three corpora with none withdrawn. The false positive is the
 * same fault mirrored, an aliased `xsl:` on a literal result element
 * drawing a check about XSLT, and it is pinned by a pack rather than by a
 * corpus: no committed stylesheet spells it, which is what let the shape
 * survive. The other five ask no question about a prefix and are narrowed
 * alone — three of them by anchoring on the attribute the check is really
 * about, `//@select[...]/..` in place of `//*[...@select...]`, and one by
 * folding two descendant walks into one parent test. What the ticket
 * proposed instead was a precondition per check — skip a (document, check)
 * pair whose name the document does not hold — and that measures **4.5%**,
 * not the 54.7% it is aimed at, because the pairs a precondition can skip
 * are the cheapest pairs there are: proving `//xsl:sort` empty on a
 * document holding no sort is nearly free, and the cost was never in the
 * checks that find nothing. What was left of the ticket after that change
 * was one selector evaluation per check per document — 38 of them, 35
 * holding a descendant step — and the answer is the walk `src/tree.js`
 * already remembers, not a precondition in front of each. `splitOf` in
 * `src/selectors.js` parts a selector into the names a bucketed walk can
 * serve and the tail the engine must still answer, so 24 of the 38 take
 * their axis off one native pass and pay fontoxpath for a predicate over
 * the candidates alone — 27 since #811 served a union of them and 30 since
 * it served what stands below an anchor. `xpath-linter` falls from 5.64 to
 * 3.64 seconds over DocBook-XSL, 4.63 to 2.82 over TEI and 1.97 to 1.32
 * over DITA-OT — 35%, 39% and 33%, the lowest of three interleaved rounds a
 * side — taking the staged run down 20%, 21% and 16%, and the report is
 * byte-identical on all three, at 3843, 5716 and 1266 defects. What the
 * uniformity costs is one wrapper per candidate: a tail is asked as
 * `self::node()` followed by the selector's own predicates, which is 0.05 s
 * over DocBook-XSL against asking each predicate bare, the lowest of seven
 * interleaved rounds a side, and it is kept because one shape for every
 * tail is worth more than a special case per selector. The eight it cannot
 * serve are listed in `UNINDEXED` in `test/conformance.test.js`, each
 * beside the shape that keeps it out, and that gate turns red from both
 * sides: a selector that becomes servable and stays listed fails as loudly
 * as one that stops being served. What those fifteen still spent when that
 * was measured is 2.78 of the stage's 3.64 seconds over DocBook-XSL, and a
 * reason on that list is not a statement about cost: nine of them were
 * root-anchored, which kept them out because a root step is no descendant
 * sweep, yet six of those nine descended *below* their anchor — and #811's
 * anchor phase serves three of the six, an anchor being one question for
 * the document where the sweep behind it was a traversal apiece. The eight
 * left are 1.27 of the stage's 2.83 seconds over DocBook-XSL, five of them
 * the root itself with a predicate that descends, where the axis is one
 * node and the whole cost is inside the brackets. The dearest is still
 * `modern-construct-in-xslt-1`, at 0.63 s, whose union ends in an
 * `xsl:*[@as]`: nine narrow arms the walk already holds, a tenth naming a
 * whole namespace, and a predicate on that tenth which `hasAttribute`
 * answers in 10 ms where asking the engine once per candidate costs 150. So
 * what a richer index takes next is still drawn by cost rather than by the
 * shape that excluded it. Swapping the DOM underneath was measured instead
 * and refused: slimdom, fontoxpath's own development dependency, answers
 * `//*` over DocBook-XSL in 0.271 s where xmldom takes 0.869 and the native
 * walk of those 69,842 elements takes 0.011 to 0.020, so it buys a quarter
 * of a traversal and leaves the rest — and it parses 283 of the 315
 * stylesheets where xmldom parses 297, which is a different report rather
 * than a faster one.
 */

const {chosen} = require('../selectors')
const {isValid} = require('../syntax')
const {FIXERS} = require('../fixers')
const {expressionsOf} = require('../attributes')
const {kinds} = require('../resources/checks.json')
const {logger} = require('../logger')

/**
 * Xpath packs: the name suppressions match against and the rule the linter
 * applies.
 * @type {Array.<{name: string, xpath: string, severity: string,
 *  message: string}>}
 */
const PACKS = Object.entries(kinds.xpath).map(([name, pack]) => ({
  name, ...pack,
}))

/**
 * Names of the checks this linter owns.
 * @type {Array.<string>}
 */
const names = PACKS.map((pack) => pack.name)

/**
 * The refusal already worked out for a document. A declarative fix is offered
 * per defect, and the answer is a property of the stylesheet, so it is derived
 * once and remembered against the document itself the way `expressionsOf` is —
 * a `WeakMap` releases it when the corpus does.
 * @type {WeakMap}
 */
const REFUSED = new WeakMap()

/**
 * The nodes no fix may be attached to: every node holding an expression the
 * grammar refuses — an attribute, or a text node whose braces carry a template
 * — and the element around it, since a declarative rule selects the element
 * while the fix lands somewhere inside, named where no gate can read it.
 * Withholding every fix on such an element is deliberate (#651).
 * @param {Document} xsl - XSL document parsed as {@link Document}
 * @return {Set.<Node>} - The nodes a fix must not be offered on
 */
const refused = function(xsl) {
  if (!REFUSED.has(xsl)) {
    const found = new Set()
    for (const held of expressionsOf(xsl)) {
      if (!isValid(held)) {
        const owner = held.node.ownerElement || held.node.parentNode
        found.add(held.node)
        found.add(owner)
        for (const beside of owner.attributes) {
          found.add(beside)
        }
      }
    }
    REFUSED.set(xsl, found)
  }
  return REFUSED.get(xsl)
}

/**
 * Lint the corpus of stylesheets by per-file Xpath packs.
 * @param {Array.<{file: string, xsl: Document}>} corpus - Parsed stylesheets
 * @param {Array.<string>} suppressions - Array of suppressed checks
 * @return {{name: string, severity: string, message: string, file: string,
 *  line: number, pos: number}[]} - Defects found
 */
const lintByXpath = function(corpus, suppressions = []) {
  logger.debug(`Xpath linting started`)
  const defects = []
  const active = PACKS.filter(
    (pack) => !suppressions.some((sup) => pack.name.includes(sup)),
  )
  for (const {file, content, xsl} of corpus) {
    for (const pack of active) {
      for (const node of chosen(xsl, pack.xpath)) {
        const defect = {
          name: pack.name,
          severity: pack.severity,
          message: pack.message,
          file: file,
          line: node.lineNumber,
          pos: node.columnNumber,
        }
        const fix = FIXERS[pack.name] && !refused(xsl).has(node) &&
          FIXERS[pack.name](node, content)
        if (fix) {
          defect.fix = fix
        }
        defects.push(defect)
      }
    }
  }
  logger.debug(`Found ${defects.length} defects`)
  return defects
}

module.exports = {
  lintByXpath,
  names,
}
