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
  authoredOpenPrListCmd,
  myOpenPrListCmd,
  withoutDuplicates,
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
  const cmd = reviewRequestedSearchCmd('justinbrenton/githermes')
  assert.match(cmd, /gh search prs --repo 'justinbrenton\/githermes' --review-requested @me --state open --limit 30 /)
  // `gh search prs --json` has no reviewDecision or statusCheckRollup, so the
  // command must not ask for them or GitHub errors out and the section empties.
  assert.ok(cmd.endsWith('--json number,title,state,author,updatedAt,url,repository,isDraft'))
})

test('team review search is repo-scoped and quotes hostile team names', () => {
  assert.match(teamReviewSearchCmd('justinbrenton/githermes', 'platform'), /--repo 'justinbrenton\/githermes' --review-requested 'platform' --state open --limit 20 /)
  assert.ok(teamReviewSearchCmd('o/r', "x'; rm -rf ~").includes("'x'\\''; rm -rf ~'"))
})

test('draft search keeps --draft and the search field set', () => {
  const cmd = draftSearchCmd('o/r')
  assert.match(cmd, /gh search prs --repo 'o\/r' --author @me --draft --state open --limit 30 /)
  assert.ok(!cmd.includes('statusCheckRollup'))
})

test('pr list commands never ask for the repository field', () => {
  // `gh pr list --json repository` fails the whole call; the pane then shows an
  // empty section with no error, which is how this section broke before.
  for (const cmd of [authoredOpenPrListCmd('o/r'), myOpenPrListCmd('o/r')]) {
    assert.ok(cmd.includes('--json number,title,state,author,updatedAt,url,isDraft,reviewDecision,statusCheckRollup,mergeable'), cmd)
    assert.ok(!cmd.includes('repository'), cmd)
  }
  assert.match(myOpenPrListCmd('o/r'), /pr list --repo 'o\/r' --author @me --state open /)
})

test('the team section drops rows the personal section already shows', () => {
  const shared = { number: 7, url: 'u7' }
  const teamOnly = { number: 8, url: 'u8' }
  const personalOnly = { number: 9, url: 'u9' }
  assert.deepEqual(withoutDuplicates([shared, teamOnly], [personalOnly, shared]).map(p => p.number), [8])
  assert.deepEqual(withoutDuplicates(null, [shared]), [])
  assert.deepEqual(withoutDuplicates([teamOnly], null).map(p => p.number), [8])
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
