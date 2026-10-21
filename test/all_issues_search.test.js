import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { recentIssuesSearchCmd, mentionedIssuesSearchCmd } from '../desktop/plugin.js'

const source = readFileSync(new URL('../desktop/plugin.js', import.meta.url), 'utf8')

test('recent issues is personal and asks for newest first', () => {
  const cmd = recentIssuesSearchCmd('open')
  assert.match(cmd, /gh search issues/)
  // Without a user filter this searches all of GitHub and returns strangers'
  // issues, which is what the section showed before.
  assert.ok(cmd.includes('--involves @me'), 'Recent must be scoped to the user')
  assert.match(cmd, /--sort updated/)
  assert.match(cmd, /--order desc/)
  assert.match(cmd, /--limit 30/)
  assert.ok(!cmd.includes('--updated-desc'), 'gh has no --updated-desc flag')
})

test('mentioned issues asks for literal mentions', () => {
  const cmd = mentionedIssuesSearchCmd('open')
  assert.ok(cmd.includes('--mentions @me'), 'Mentioned must use --mentions')
  // Mirrors `is:issue state:open archived:false mentions:@me sort:updated-desc`.
  // PRs are excluded by default; archived repos are not.
  assert.ok(cmd.includes('--archived=false'), 'archived repositories must stay out')
  assert.match(cmd, /--sort updated/)
  assert.match(cmd, /--order desc/)
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

test('the two sections do not collapse into the same query', () => {
  // --involves covers authored, assigned, mentioned and reviewed. Using it for
  // both made Mentioned a duplicate of Recent with a smaller limit.
  assert.notEqual(
    recentIssuesSearchCmd('open').replace('--limit 30', ''),
    mentionedIssuesSearchCmd('open').replace('--limit 5', ''),
  )
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
    assert.deepEqual(flags.filter(flag => !known.has(flag)), [], `unknown flags in: ${cmd}`)
  }
})

test('recent issues reads through the big-payload path', () => {
  // 30 rows with url, author and repository serialise past the gateway's 4 KB
  // stdout cap, and a capped read truncates the JSON mid-string.
  const start = source.indexOf('function useRecentIssues')
  const body = source.slice(start, source.indexOf('\nfunction ', start + 1))
  assert.ok(body.includes('shJsonBig('), 'Recent must use shJsonBig for its 30-row payload')
  assert.ok(!body.includes('await sh('), 'Recent must not read through the capped sh()')
})
