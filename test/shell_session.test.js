import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  bashProbeCommand,
  pickSessionId,
  sessionShellParams,
} from '../desktop/plugin.js'

const source = readFileSync('desktop/plugin.js', 'utf8')

test('the bash probe quotes the candidate path', () => {
  // cmd.exe strips only the outer quotes, so an unquoted path with a space can
  // never match. This is the default Git for Windows location.
  assert.equal(
    bashProbeCommand('C:\\Program Files\\Git\\bin\\bash.exe'),
    'if exist "C:\\Program Files\\Git\\bin\\bash.exe" echo FOUND'
  )
  assert.ok(bashProbeCommand('C:\\tools\\bash.exe').includes('"C:\\tools\\bash.exe"'))
})

test('session id prefers the focused tile, then the active session', () => {
  assert.equal(pickSessionId('focused-1', 'active-1'), 'focused-1')
  assert.equal(pickSessionId(null, 'active-1'), 'active-1')
  assert.equal(pickSessionId(undefined, undefined), null)
  assert.equal(pickSessionId('', ''), null)
})

test('shell.exec params carry session_id only when one exists', () => {
  // Hermes 0.22.1+ rejects a call without session_id, older gateways never
  // learned the field. Both have to work from one construction point.
  assert.deepEqual(sessionShellParams('echo hi', 's-1'), { command: 'echo hi', session_id: 's-1' })
  assert.deepEqual(sessionShellParams('echo hi', null), { command: 'echo hi' })
  assert.equal(Object.hasOwn(sessionShellParams('echo hi', null), 'session_id'), false)
})

test('every shell.exec call site goes through sessionShellParams', () => {
  const callSites = source.match(/requestShell\(sessionShellParams\(/g) || []
  assert.ok(callSites.length >= 4, `expected at least 4 wrapped call sites, found ${callSites.length}`)
  // One raw call is allowed, inside requestShell, which is where the error is
  // translated. Any other raw call would skip the session_id.
  const raw = (source.match(/host\.request\('shell\.exec'/g) || []).length
  assert.equal(raw, 2, `expected 1 raw call plus the banner comment, found ${raw}`)
})

test('a failed resolution is not cached', () => {
  // bashReady must reset so the next call retries once a chat session exists.
  assert.match(source, /if \(!bashPath\) bashReady = null/)
})
