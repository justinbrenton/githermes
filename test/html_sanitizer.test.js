import test from 'node:test'
import assert from 'node:assert/strict'
import { stripHtml, mdBlocks } from '../desktop/plugin.js'

test('stripHtml removes tags and complete comments', () => {
  assert.equal(stripHtml('<b>hi</b>'), 'hi')
  assert.equal(stripHtml('a <!-- c --> b'), 'a  b')
  assert.equal(stripHtml('plain text'), 'plain text')
  assert.equal(stripHtml(null), '')
  assert.equal(stripHtml(undefined), '')
})

test('an overlapping comment delimiter cannot survive sanitising', () => {
  // CodeQL js/incomplete-multi-character-sanitization: one pass turned
  // `<!<!-- c -->-->` into `<!-->` and left a live comment opener behind.
  for (const input of ['<!<!-- c -->-->', '<!<!<!-- c -->-->>', '<!<b>x</b>-->']) {
    const out = stripHtml(input)
    assert.ok(!out.includes('<!--'), `left an opener in ${JSON.stringify(out)}`)
  }
})

test('mdBlocks sanitises before parsing and still splits paragraphs', () => {
  const blocks = mdBlocks('para one\n\npara two')
  assert.equal(blocks.length, 2)
  const dirty = mdBlocks('<!<!-- x -->-->\n\nbody')
  assert.ok(!JSON.stringify(dirty).includes('<!--'), 'comment opener survived into the blocks')
})
