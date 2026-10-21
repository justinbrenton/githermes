import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Shell invocation is platform-sensitive: the same command string crosses a
// POSIX login shell on macOS/Linux and cmd.exe on Windows. Everything the
// plugin pipes through `shBig` (od / tr / wc / tail / printf / unlink / /tmp)
// only exists on the POSIX side.
const source = readFileSync(new URL('../desktop/plugin.js', import.meta.url), 'utf8')

test('shell: every gh/hermes invocation resolves the binary per platform', () => {
  // A hardcoded `PATH=/opt/homebrew/...:$PATH gh` prefix is a VARIABLE NAMES
  // assignment under cmd.exe: gh never runs and the call "succeeds" with empty
  // stdout, which is worse than a visible failure.
  assert.ok(!source.includes("const GH = 'PATH="), 'GH must not hardcode a POSIX PATH prefix')
  assert.ok(!source.includes("const HERMES = 'PATH="), 'HERMES must not hardcode a POSIX PATH prefix')
  assert.ok(source.includes('const POSIX_SHELL ='), 'platform detection is missing')
  assert.ok(source.includes("${POSIX_SHELL ? POSIX_PATH : ''}gh"), 'GH must be platform-gated')
  assert.ok(source.includes("${POSIX_SHELL ? POSIX_PATH : ''}hermes"), 'HERMES must be platform-gated')
})

test('shell: every shell.exec goes through shellExec and the negotiation wrapper', () => {
  // One raw `host.request('shell.exec', ...)` is allowed, inside attemptShell,
  // where the session_id shape is negotiated. Every query goes through
  // shellExec -> shellCommand so nothing bypasses the Windows bash hop.
  assert.ok(source.includes('async function shellExec(cmd)'), 'shellExec wrapper is missing')
  assert.ok(source.includes('export async function sh(cmd)'), 'sh must be exported for tests')
  const wrapped = source.match(/await shellExec\(cmd\)/g) || []
  assert.ok(wrapped.length >= 2, `expected the gh callers to route through shellExec, found ${wrapped.length}`)
  assert.equal(
    (source.match(/host\.request\('shell\.exec'/g) || []).length,
    2,
    'expected the banner comment plus exactly one raw call inside attemptShell',
  )
  assert.ok(source.includes('sessionModeForError'), 'session_id support must be negotiated with the backend')
  assert.ok(source.includes('lastSessionId'), 'a fresh draft must reuse the last live chat')
  // cmd.exe parses the whole command string (no \" handling; |>&^% are live), so user
  // text may only cross it as base64; bash decodes to a $$-unique script and runs it.
  assert.ok(!source.includes('echo ${cmd}'), 'raw command text must not cross cmd.exe')
  assert.ok(
    source.includes('| base64 -d > /tmp/gt$$.sh; bash /tmp/gt$$.sh; e=$?; unlink /tmp/gt$$.sh; exit $e'),
    'Windows commands must decode from base64 inside bash with per-invocation state',
  )
})

test('shell: Windows routes through Git bash, not WSL bash', () => {
  // Windows ships WSL's bash.exe in System32; invoking it would run the command
  // against a different filesystem with no `gh` on PATH. Resolve bash from the
  // installed Git instead of trusting PATH.
  assert.ok(source.includes('function resolveBash'), 'resolveBash is missing')
  assert.ok(source.includes("requestShell('where git')"), 'bash must be derived from the git install')
  assert.ok(source.includes('(?:cmd|mingw64\\/bin|usr\\/bin)'), 'all Git-for-Windows install layouts must resolve')
  assert.ok(source.includes('bash.exe'), 'expected Git-for-Windows bash candidates')
  assert.ok(source.includes('bashProbeCommand'), 'the probe must be built by one helper')
  assert.ok(!/const BASH = '[A-Z]:/.test(source), 'bash path must not be hardcoded to a drive letter')
  // The first command must wait for the Git-for-Windows probe; it must never
  // race into bare `bash` and accidentally launch System32's WSL shim.
  assert.ok(source.includes('let bashReady = null'), 'bash resolution must be shared')
  assert.ok(source.includes('await resolveBash()'), 'shell commands must await bash resolution')
  assert.ok(source.includes('Git for Windows bash.exe was not found'), 'missing Git Bash needs a clear recovery error')
})

test('shell: registration does not probe a shell before a chat exists', () => {
  const register = source.slice(source.indexOf('register(ctx) {'))
  assert.ok(!register.includes('resolveBash()'), 'registration must not require a session to probe bash')
})

test('shell: every shell.exec can carry a session_id (#107)', () => {
  // Hermes' session-authority shell.exec rejects a call without session_id as
  // invalid_params, which surfaced as "Could not load repositories". The plugin
  // negotiates the shape instead of hardcoding it, so every call site goes
  // through requestShell and sessionShellParams.
  assert.ok(source.includes('function sessionShellParams(command, sessionId)'), 'session params builder is missing')
  assert.ok(source.includes('sessionModeForError'), 'legacy vs session authority must be negotiated')
  const raw = source.split('\n').filter(line => line.includes("host.request('shell.exec'"))
  // The banner comment plus the single call inside attemptShell.
  assert.equal(raw.length, 2, `expected the comment and one raw call inside attemptShell, found ${raw.length}`)
  const call = raw.find(line => line.includes('shellShellParamsFor('))
  assert.ok(call, 'attemptShell must build params through the session helper')
  assert.ok(source.includes('focusedSessionId') && source.includes('activeSessionId'), 'must read the session from host.state')
})
