import test from 'node:test'
import assert from 'node:assert/strict'
import {
  prCheckFailed,
  prChecksPass,
  prNeedsAction,
  prWaitingOnReview,
  prReadyToMerge,
  parseTeamSlugs,
  dedupePrs,
  reviewRequestedSearchCmd,
  teamReviewSearchCmd,
  draftSearchCmd,
  inboxAuthoredPrsCmd,
  parseInboxAuthoredPrs,
  withoutDuplicates,
  filterInboxList,
} from '../desktop/plugin.js'

const pr = (over = {}) => ({
  number: 1,
  url: 'https://github.com/o/r/pull/1',
  state: 'OPEN',
  isDraft: false,
  reviewDecision: '',
  statusCheckRollup: null,
  mergeable: 'MERGEABLE',
  ...over,
})

const rollup = (conclusion, bucket) => ({ conclusion, bucket })

test('prCheckFailed reads conclusion and bucket', () => {
  assert.equal(prCheckFailed(pr({ statusCheckRollup: rollup('FAILURE', 'fail') })), true)
  assert.equal(prCheckFailed(pr({ statusCheckRollup: rollup('', 'fail') })), true)
  assert.equal(prCheckFailed(pr({ statusCheckRollup: rollup('SUCCESS', 'pass') })), false)
  assert.equal(prCheckFailed(pr({ statusCheckRollup: null })), false)
})

test('prChecksPass treats an empty rollup as passing', () => {
  assert.equal(prChecksPass(pr({ statusCheckRollup: rollup('SUCCESS', 'pass') })), true)
  assert.equal(prChecksPass(pr({ statusCheckRollup: null })), true)
  assert.equal(prChecksPass(pr({ statusCheckRollup: rollup('PENDING', 'pending') })), false)
  assert.equal(prChecksPass(pr({ statusCheckRollup: rollup('FAILURE', 'fail') })), false)
})

test('prNeedsAction covers failing checks, required changes and conflicts', () => {
  assert.equal(prNeedsAction(pr({ statusCheckRollup: rollup('FAILURE', 'fail') })), true)
  assert.equal(prNeedsAction(pr({ reviewDecision: 'CHANGES_REQUESTED' })), true)
  assert.equal(prNeedsAction(pr({ mergeable: 'CONFLICTING' })), true)
  assert.equal(prNeedsAction(pr({ reviewDecision: 'APPROVED', statusCheckRollup: rollup('SUCCESS', 'pass') })), false)
})

test('prWaitingOnReview excludes drafts, approved PRs and anything needing action', () => {
  assert.equal(prWaitingOnReview(pr({ isDraft: true })), false)
  assert.equal(prWaitingOnReview(pr({ reviewDecision: 'APPROVED', statusCheckRollup: rollup('SUCCESS', 'pass') })), false)
  assert.equal(prWaitingOnReview(pr({ reviewDecision: 'REVIEW_REQUIRED' })), true)
  assert.equal(prWaitingOnReview(pr({ statusCheckRollup: rollup('PENDING', 'pending') })), true)
  assert.equal(prWaitingOnReview(pr({ statusCheckRollup: rollup('FAILURE', 'fail') })), false)
  assert.equal(prWaitingOnReview(pr({ reviewDecision: 'CHANGES_REQUESTED' })), false)
})

test('prReadyToMerge needs no blocking review and passing checks', () => {
  assert.equal(prReadyToMerge(pr({ reviewDecision: 'APPROVED', statusCheckRollup: rollup('SUCCESS', 'pass') })), true)
  assert.equal(prReadyToMerge(pr({ reviewDecision: 'APPROVED' })), true)
  assert.equal(prReadyToMerge(pr({ reviewDecision: 'REVIEW_REQUIRED', statusCheckRollup: rollup('SUCCESS', 'pass') })), false)
  assert.equal(prReadyToMerge(pr({ reviewDecision: 'APPROVED', statusCheckRollup: rollup('PENDING', 'pending') })), false)
  assert.equal(prReadyToMerge(pr({ isDraft: true, reviewDecision: 'APPROVED' })), false)
  assert.equal(prReadyToMerge(pr({ mergeable: 'CONFLICTING', reviewDecision: 'APPROVED' })), false)
})

test('check helpers read the array shape gh pr list actually returns', () => {
  const run = (status, conclusion) => ({ __typename: 'CheckRun', status, conclusion })
  const ctx = state => ({ __typename: 'StatusContext', state })

  assert.equal(prCheckFailed(pr({ statusCheckRollup: [run('COMPLETED', 'FAILURE')] })), true)
  assert.equal(prCheckFailed(pr({ statusCheckRollup: [run('COMPLETED', 'SUCCESS'), ctx('ERROR')] })), true)
  assert.equal(prCheckFailed(pr({ statusCheckRollup: [run('COMPLETED', 'SUCCESS'), run('COMPLETED', 'SKIPPED')] })), false)

  assert.equal(prChecksPass(pr({ statusCheckRollup: [run('COMPLETED', 'SUCCESS')] })), true)
  assert.equal(prChecksPass(pr({ statusCheckRollup: [run('COMPLETED', 'SKIPPED'), run('COMPLETED', 'NEUTRAL')] })), true)
  assert.equal(prChecksPass(pr({ statusCheckRollup: [run('IN_PROGRESS', '')] })), false)
  assert.equal(prChecksPass(pr({ statusCheckRollup: [ctx('PENDING')] })), false)
  assert.equal(prChecksPass(pr({ statusCheckRollup: [] })), true)

  assert.equal(prNeedsAction(pr({ statusCheckRollup: [run('COMPLETED', 'FAILURE')] })), true)
  assert.equal(prWaitingOnReview(pr({ statusCheckRollup: [run('COMPLETED', 'FAILURE')] })), false)
  assert.equal(prWaitingOnReview(pr({ statusCheckRollup: [run('IN_PROGRESS', '')] })), true)
  assert.equal(prReadyToMerge(pr({ reviewDecision: 'APPROVED', statusCheckRollup: [run('COMPLETED', 'SUCCESS')] })), true)
  assert.equal(prReadyToMerge(pr({ reviewDecision: 'APPROVED', statusCheckRollup: [run('IN_PROGRESS', '')] })), false)
})

test('waiting and ready never claim the same PR', () => {
  const shapes = [
    pr({}),
    pr({ statusCheckRollup: [{ status: 'IN_PROGRESS', conclusion: '' }] }),
    pr({ statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }] }),
    pr({ statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }] }),
    pr({ reviewDecision: 'APPROVED', statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }] }),
    pr({ reviewDecision: 'REVIEW_REQUIRED' }),
    pr({ reviewDecision: 'CHANGES_REQUESTED' }),
    pr({ isDraft: true }),
    pr({ mergeable: 'CONFLICTING' }),
  ]
  for (const shape of shapes) {
    assert.equal(prWaitingOnReview(shape) && prReadyToMerge(shape), false, `overlap for ${JSON.stringify(shape)}`)
  }
})

test('review-requested search asks the right question', () => {
  const cmd = reviewRequestedSearchCmd()
  // The Inbox is global: no --repo, so every repository is searched.
  assert.ok(!cmd.includes('--repo'), cmd)
  assert.match(cmd, /gh search prs --review-requested @me --state open --limit 30 /)
  // `gh search prs --json` has no reviewDecision or statusCheckRollup, so the
  // command must not ask for them or GitHub errors out and the section empties.
  assert.ok(cmd.endsWith('--json number,title,state,author,updatedAt,url,repository,isDraft'))
})

test('a repo can still be passed explicitly when a caller wants one', () => {
  assert.match(reviewRequestedSearchCmd('justinbrenton/githermes'), /--repo 'justinbrenton\/githermes'/)
})

test('team review search is repo-scoped and quotes hostile team names', () => {
  assert.match(teamReviewSearchCmd('justinbrenton/githermes', 'platform'), /--repo 'justinbrenton\/githermes' --review-requested 'platform' --state open --limit 20 /)
  assert.ok(teamReviewSearchCmd('o/r', "x'; rm -rf ~").includes("'x'\\''; rm -rf ~'"))
})

test('draft search keeps --draft and the search field set', () => {
  const cmd = draftSearchCmd()
  assert.ok(!cmd.includes('--repo'), cmd)
  assert.match(cmd, /gh search prs --author @me --draft --state open --limit 30 /)
  assert.ok(!cmd.includes('statusCheckRollup'))
})

test('the authored PR read is GraphQL and carries the status fields', () => {
  const cmd = inboxAuthoredPrsCmd()
  assert.match(cmd, /gh api graphql/)
  assert.ok(!cmd.includes('--repo'), 'the inbox spans every repository')
  for (const field of ['reviewDecision', 'mergeable', 'statusCheckRollup']) {
    assert.ok(cmd.includes(field), `missing ${field}: ${cmd}`)
  }
})

test('parseInboxAuthoredPrs flattens the GraphQL search envelope', () => {
  const json = { data: { search: { nodes: [
    null,
    {
      number: 16, title: 'fix', url: 'u', isDraft: false, state: 'OPEN',
      updatedAt: '2026-10-21T00:00:00Z', reviewDecision: null, mergeable: 'MERGEABLE',
      repository: { name: 'githermes', nameWithOwner: 'justinbrenton/githermes' },
      author: { login: 'justinbrenton' }, statusCheckRollup: { state: 'SUCCESS' },
    },
  ] } } }
  const rows = parseInboxAuthoredPrs(json)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].repository.nameWithOwner, 'justinbrenton/githermes')
  assert.equal(rows[0].statusCheckRollup.state, 'SUCCESS')
  assert.deepEqual(parseInboxAuthoredPrs({ data: { search: null } }), [])
  assert.deepEqual(parseInboxAuthoredPrs(null), [])
})

test('the team section drops rows the personal section already shows', () => {
  const shared = { number: 7, url: 'u7' }
  const teamOnly = { number: 8, url: 'u8' }
  const personalOnly = { number: 9, url: 'u9' }
  assert.deepEqual(withoutDuplicates([shared, teamOnly], [personalOnly, shared]).map(p => p.number), [8])
  assert.deepEqual(withoutDuplicates(null, [shared]), [])
  assert.deepEqual(withoutDuplicates([teamOnly], null).map(p => p.number), [8])
})

test('the Inbox honours the search box, exact numbers included', () => {
  const rows = [
    { number: 12, title: 'Bump actions', author: { login: 'octocat' }, labels: [{ name: 'chore' }] },
    { number: 112, title: 'Fix picker', author: { login: 'hubot' }, labels: [{ name: 'bug' }] },
    { number: 9, title: 'Add palette', author: { login: 'octocat' }, labels: [] },
  ]
  assert.deepEqual(filterInboxList(rows, '').map(r => r.number), [12, 112, 9])
  assert.deepEqual(filterInboxList(rows, '#12').map(r => r.number), [12])
  assert.deepEqual(filterInboxList(rows, '#112').map(r => r.number), [112])
  assert.deepEqual(filterInboxList(rows, 'author:octocat').map(r => r.number), [12, 9])
  assert.deepEqual(filterInboxList(rows, 'label:bug').map(r => r.number), [112])
  assert.deepEqual(filterInboxList(rows, 'palette').map(r => r.number), [9])
  assert.deepEqual(filterInboxList(null, '#1'), [])
})

test('parseTeamSlugs survives empty and malformed output', () => {
  assert.deepEqual(parseTeamSlugs(''), [])
  assert.deepEqual(parseTeamSlugs('not json'), [])
  assert.deepEqual(parseTeamSlugs('{"a":1}'), [])
  assert.deepEqual(parseTeamSlugs('[{"slug":"platform"},{"slug":"web-ui"}]'), ['platform', 'web-ui'])
  assert.deepEqual(parseTeamSlugs('[{"slug":""},{"name":"x"}]'), [])
})

test('dedupePrs keeps the first row per url', () => {
  const a = pr({ number: 1, url: 'u1' })
  const b = pr({ number: 2, url: 'u2' })
  const dup = pr({ number: 9, url: 'u1' })
  assert.deepEqual(dedupePrs([a, b, dup]).map(p => p.number), [1, 2])
  assert.deepEqual(dedupePrs(null), [])
})
