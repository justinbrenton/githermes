import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { recentIssuesSearchCmd, mentionedIssuesSearchCmd } from '../desktop/plugin.js'

// Both commands shipped with flags `gh search issues` does not accept, and the
// hooks swallow the failure as "no data", so the sections looked empty rather
// than broken. These tests pin the exact commands and, when the CLI is present,
// check every flag against its own help output.

test('recent issues asks for newest first, not a bundled flag', () => {
  const cmd = recentIssuesSearchCmd('open')
  assert.match(cmd, /gh search issues/)
  assert.match(cmd, /--sort updated/)
  assert.match(cmd, /--order desc/)
  assert.match(cmd, /--limit 30/)
  assert.ok(!cmd.includes('--updated-desc'), 'gh has no --updated-desc flag')
})

test('mentioned issues uses --involves, not a search string', () => {
  const cmd = mentionedIssuesSearchCmd('open')
  assert.match(cmd, /gh search issues/)
  assert.match(cmd, /--involves @me/)
  assert.match(cmd, /--limit 5/)
  assert.ok(!cmd.includes('--search '), 'gh search issues has no --search flag')
})

test('the state filter still maps open, closed and all', () => {
  assert.match(recentIssuesSearchCmd('open'), /--state open/)
  assert.match(recentIssuesSearchCmd('closed'), /--state closed/)
  assert.ok(!recentIssuesSearchCmd('all').includes('--state'))
  assert.match(mentionedIssuesSearchCmd('closed'), /--state closed/)
  assert.ok(!mentionedIssuesSearchCmd('all').includes('--state'))
})

test('every flag exists in gh search issues --help', () => {
  let help = ''
  try {
    help = execFileSync('gh', ['search', 'issues', '--help'], { encoding: 'utf8' })
  } catch {
    return // gh not on PATH: the exact-string tests above still run
  }
  const known = new Set(help.split(/[\s,()[\]|=]+/).filter(Boolean))
  for (const cmd of [recentIssuesSearchCmd('open'), mentionedIssuesSearchCmd('open')]) {
    const flags = [...new Set(cmd.match(/--[a-z][a-z-]*/g) || [])]
    const unknown = flags.filter(flag => !known.has(flag))
    assert.deepEqual(unknown, [], `unknown flags in: ${cmd}`)
  }
})
