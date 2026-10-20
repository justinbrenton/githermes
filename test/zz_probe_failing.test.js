import test from 'node:test'
import assert from 'node:assert/strict'

// Probe for the Inbox 'Needs action' section: this assertion is meant to fail
// so the tests workflow reports a failing check.
test('probe: intentionally failing check', () => {
  assert.equal(1, 2, 'probe failure: expected by design')
})
