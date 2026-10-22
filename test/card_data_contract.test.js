import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assignedIssuesSearchCmd,
  createdIssuesSearchCmd,
  recentIssuesSearchCmd,
  mentionedIssuesSearchCmd,
  inboxPrsCmd,
} from '../desktop/plugin.js'

const source = readFileSync(new URL('../desktop/plugin.js', import.meta.url), 'utf8')

// Every identifier a card paints has to come from the query behind it. Two
// rounds of work went into card markup while the queries never asked for
// labels, so the guard here compares each card's fields against its command.
const PR_CARD_FIELDS = [
  'number', 'title', 'author', 'updatedAt', 'labels', 'isDraft',
  'headRefName', 'additions', 'deletions', 'changedFiles',
  'statusCheckRollup', 'reviewDecision',
]
const ISSUE_CARD_FIELDS = ['number', 'title', 'author', 'updatedAt', 'labels']

const firstMatch = pattern => (source.match(pattern) || [''])[0]

test('the PR tab query asks for every field its card paints', () => {
  // The list command, not the session-branch lookup that also starts with
  // `pr list --repo` but carries five fields for a different card.
  const cmd = firstMatch(/pr list --repo[^`]*--state[^`]*/)
  assert.ok(cmd, 'gh pr list command not found')
  for (const field of PR_CARD_FIELDS) {
    assert.ok(cmd.includes(field), `gh pr list is missing ${field}: ${cmd}`)
  }
})

test('the Inbox query asks for every field its card paints', () => {
  const cmd = inboxPrsCmd('is:pr author:@me')
  for (const field of PR_CARD_FIELDS) {
    assert.ok(cmd.includes(field), `inbox GraphQL is missing ${field}: ${cmd}`)
  }
})

test('the Issues tab query asks for every field its card paints', () => {
  const cmd = firstMatch(/issue list --repo[^`]*/)
  assert.ok(cmd, 'gh issue list command not found')
  for (const field of ISSUE_CARD_FIELDS) {
    assert.ok(cmd.includes(field), `gh issue list is missing ${field}: ${cmd}`)
  }
})

test('all four All Issues queries ask for every field the issue card paints', () => {
  const sections = {
    assigned: assignedIssuesSearchCmd('open'),
    created: createdIssuesSearchCmd('open'),
    recent: recentIssuesSearchCmd('open'),
    mentioned: mentionedIssuesSearchCmd('open'),
  }
  for (const [name, cmd] of Object.entries(sections)) {
    for (const field of ISSUE_CARD_FIELDS) {
      assert.ok(cmd.includes(field), `${name} is missing ${field}: ${cmd}`)
    }
  }
})

test('a label chip needs name and colour from both sources', () => {
  // LabelChip paints from label.name and label.color; a query that returns one
  // without the other renders a chip with no text or no colour.
  const issueCmd = assignedIssuesSearchCmd('open')
  assert.ok(issueCmd.includes('labels'), 'gh search issues must return labels')
  const inbox = inboxPrsCmd('is:pr author:@me')
  assert.ok(inbox.includes('labels(first:12){nodes{name color}}'), 'inbox labels need name and colour')
})
