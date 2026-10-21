import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  bashProbeCommand,
  pickSessionId,
  sessionShellParams,
  sessionModeForError,
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

test('every shell.exec call site goes through requestShell', () => {
  const callSites = source.match(/requestShell\(/g) || []
  // Definition, shellExec, the where-git probe, the saved-path probe and the
  // candidate probe. sh and shJsonLoose reach the shell through shellExec.
  assert.ok(callSites.length >= 5, `expected the helper plus four call sites, found ${callSites.length}`)
  assert.equal(
    (source.match(/host\.request\('shell\.exec'/g) || []).length,
    2,
    'expected the banner comment plus exactly one raw call inside attemptShell',
  )
  assert.ok(source.includes('sessionShellParams(command, withSession'), 'the helper is the only place params are built')
})

test('a backend that rejects or demands session_id is detected from its error', () => {
  // Hermes 0.22.1+ answers invalid_params for a missing session_id.
  assert.equal(sessionModeForError('invalid_params for shell.exec: session_id: field required'), true)
  // Older builds answer the other way round, which is what this machine did.
  assert.equal(sessionModeForError('invalid params for shell.exec: session_id: Extra inputs are not permitted'), false)
  assert.equal(sessionModeForError('Could not read from remote repository'), null)
})

test('a failed resolution is not cached', () => {
  // bashReady must reset so the next call retries once a chat session exists.
  assert.match(source, /if \(!bashPath\) bashReady = null/)
})
