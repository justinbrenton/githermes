import test from 'node:test'
import assert from 'node:assert/strict'
test('probe: intentionally failing check', () => { assert.equal(1, 2) })
