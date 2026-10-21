import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { issueSearchStateArg } from '../desktop/plugin.js'

const source = readFileSync('desktop/plugin.js', 'utf8')

// `gh search issues` accepts --state open|closed only. "All" means omit the
// flag entirely; anything unrecognised keeps the historical open default.
test('issueSearchStateArg maps pane states onto gh search flags', () => {
  assert.equal(issueSearchStateArg('open'), '--state open')
  assert.equal(issueSearchStateArg('closed'), '--state closed')
  assert.equal(issueSearchStateArg('all'), '')
  assert.equal(issueSearchStateArg('CLOSED'), '--state closed')
  assert.equal(issueSearchStateArg(undefined), '--state open')
  assert.equal(issueSearchStateArg('nonsense'), '--state open')
})

test('every All Issues hook takes a state and puts it in its query key', () => {
  for (const hook of ['useAssignedIssues', 'useCreatedIssues', 'useRecentIssues', 'useMentionedIssues']) {
    const start = source.indexOf(`function ${hook}(`)
    assert.ok(start >= 0, `${hook} is missing`)
    const body = source.slice(start, source.indexOf('\nfunction ', start + 1))
    assert.match(body, new RegExp(`function ${hook}\\(state`), `${hook} must accept state`)
    assert.ok(body.includes('issueSearchStateArg(state)'), `${hook} must derive its state flag`)
    assert.match(body, /queryKey: \[ID, '[a-z-]+', ('v\d+', )?state\]/, `${hook} must key its cache on state`)
  }
})

test('All Issues view reads the issue state atom and passes it down', () => {
  const start = source.indexOf('function AllIssuesView(')
  const body = source.slice(start, source.indexOf('\nfunction ', start + 1))
  assert.ok(body.includes('const state = useValue($issueState)'), 'AllIssuesView must read $issueState')
  for (const hook of ['useAssignedIssues', 'useCreatedIssues', 'useRecentIssues', 'useMentionedIssues']) {
    assert.ok(body.includes(`${hook}(state)`), `${hook} must receive the state`)
  }
})

test('the state select is hidden where state cannot apply', () => {
  // Inbox sections (review requests, drafts, ready-to-merge) are open-only by
  // definition; a state control there would promise something it cannot do.
  const renders = source.match(/jsx\(StateSelect, \{ kind: [^}]+ \}\)/g) || []
  assert.equal(renders.length, 2, 'expected one state select in the pane and one on the page')
  const guarded = source.match(/tab === 'inbox'\s*\?\s*null\s*:\s*jsx\(StateSelect/g) || []
  assert.equal(guarded.length, 2, 'both state selects must be suppressed on the inbox tab')
})
