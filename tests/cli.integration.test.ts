import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openLocalTarget } from '../src/core/open.js'
import { cleanupDir, initEmptyGitRepo, initGitRepo, runCli, tempDir } from './helpers.js'

describe('cli integration', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('prints the CLI version', () => {
    const repo = tempDir()
    dirs.push(repo)
    mkdirSync(repo, { recursive: true })

    const result = runCli(repo, ['--version'])

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('0.6.3')
  })

  it('walks through first-time setup, next, test, export, open, and inspect', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(
      path.join(repo, 'package.json'),
      JSON.stringify({ scripts: { test: 'node test-pass.js' } }, null, 2),
      'utf8'
    )
    writeFileSync(path.join(repo, 'test-pass.js'), "console.log('ok')\n", 'utf8')
    writeFileSync(path.join(repo, 'README.md'), '# Demo changed\n', 'utf8')

    const setup = runCli(repo, ['setup', '--test-tasks'])
    expect(setup.status).toBe(0)
    expect(setup.stdout).toContain('ForgeDesk Setup')

    const preview = runCli(repo, ['next', '--dry-run'])
    expect(preview.status).toBe(0)
    expect(preview.stdout).toContain('Action: auto-capture')
    expect(preview.stdout).toContain('Dry run: yes')

    const capture = runCli(repo, ['next'])
    expect(capture.status).toBe(0)
    expect(capture.stdout).toContain('Action: auto-capture')

    const test = runCli(repo, ['test', '--', 'node', 'test-pass.js'])
    expect(test.status).toBe(0)
    expect(test.stdout).toContain('Status: passed')

    const refreshed = runCli(repo, ['next'])
    expect(refreshed.status).toBe(0)
    expect(refreshed.stdout).toContain('Action: generate-evidence')

    const exported = runCli(repo, ['next'])
    expect(exported.status).toBe(0)
    expect(exported.stdout).toContain('Action: export')

    const inspect = runCli(repo, ['inspect', '--export'])
    expect(inspect.status).toBe(0)
    expect(inspect.stdout).toContain('Target: export')
    expect(inspect.stdout).toContain('OK: yes')

    const calls: Array<{ command: string; args: string[] }> = []
    const open = await openLocalTarget(repo, 'export', (command, args) => {
      calls.push({ command, args })
      return { status: 0 }
    })

    expect(open.target).toBe('export')
    expect(open.path).toContain('.forgedesk/exports/')
    expect(calls).toHaveLength(1)
  })

  it('shows and sets the local auto profile', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    const defaultProfile = runCli(repo, ['auto-config', '--json'])
    expect(defaultProfile.status).toBe(0)
    const defaultReport = JSON.parse(defaultProfile.stdout)
    expect(defaultReport.schemaVersion).toBe('forgedesk-auto-config-report-v1')
    expect(defaultReport.config.mode).toBe('manual')
    expect(defaultReport.source).toBe('default')

    const setProfile = runCli(repo, ['auto-config', 'set', 'assist'])
    expect(setProfile.status).toBe(0)
    expect(setProfile.stdout).toContain('Mode: assist')
    expect(setProfile.stdout).toContain('Auto profiles only control explicit local ForgeDesk automation')

    const doctor = runCli(repo, ['doctor'])
    expect(doctor.status).toBe(0)
    expect(doctor.stdout).toContain('Auto mode: assist (file)')
  })

  it('auto-captures a local change without running checks', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    mkdirSync(path.join(repo, 'src', 'auth'), { recursive: true })
    writeFileSync(path.join(repo, 'src', 'auth', 'callback.ts'), 'export const callback = true\n', 'utf8')

    const result = runCli(repo, ['auto', '--no-run'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ForgeDesk captured this change.')
    expect(result.stdout).toContain('Risk hints:')
    expect(result.stdout).toContain('Auth-related files changed')
    expect(result.stdout).toContain('No checks executed')

    const config = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
    const sessionId = config.activeSessionId
    const evidenceDir = path.join(repo, '.forgedesk', 'evidence', sessionId)
    for (const file of [
      'SUMMARY.md',
      'PR_BODY.md',
      'REVIEW_CONTEXT.md',
      'TEST_EVIDENCE.md',
      'PR_EVIDENCE.md',
      'CHANGE_SUMMARY.md',
      'TEST_RESULTS.md',
      'REVIEW_PROMPT.md',
      'evidence.json'
    ]) {
      expect(existsSync(path.join(evidenceDir, file))).toBe(true)
    }

    const session = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'sessions', `${sessionId}.json`), 'utf8'))
    expect(session.status).toBe('needs-review')
    expect(session.intent).toContain('Prepare review context')

    const bundle = JSON.parse(readFileSync(path.join(evidenceDir, 'evidence.json'), 'utf8'))
    expect(bundle.autoCapture.riskHints[0].source).toBe('rule:path-auth')
    expect(readFileSync(path.join(evidenceDir, 'SUMMARY.md'), 'utf8')).toContain('Auth-related files changed')
    expect(readFileSync(path.join(evidenceDir, 'PR_BODY.md'), 'utf8')).toContain('Generated by ForgeDesk')
    expect(readFileSync(path.join(evidenceDir, 'REVIEW_CONTEXT.md'), 'utf8')).toContain('ForgeDesk prepares review context')

    const reviewContext = runCli(repo, ['review-context'])
    expect(reviewContext.status).toBe(0)
    expect(reviewContext.stdout).toContain('# Review Context')
    expect(reviewContext.stdout).toContain('Auth-related files changed')

    const prBody = runCli(repo, ['pr'])
    expect(prBody.status).toBe(0)
    expect(prBody.stdout).toContain('## Summary')
    expect(prBody.stdout).toContain('Generated by ForgeDesk')
  })

  it('runs next as an auto-capture button for an uninitialized dirty repo', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Demo changed\n', 'utf8')

    const result = runCli(repo, ['next', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-next-v1')
    expect(report.action).toBe('auto-capture')
    expect(report.reason).toBe('dirty-no-session')
    expect(report.recommendation).toContain('Run or record tests')
    expect(report.summary).toContain('Captured local changes')
    expect(report.commands).toContain('forgedesk test -- <command>')
    expect(report.commands).toContain('forgedesk next')
    expect(report.outputDir).toContain('.forgedesk/evidence')

    const config = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
    const evidenceDir = path.join(repo, '.forgedesk', 'evidence', config.activeSessionId)
    expect(existsSync(path.join(evidenceDir, 'REVIEW_CONTEXT.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'PR_BODY.md'))).toBe(true)
  })

  it('previews auto-capture with next --dry-run without writing ForgeDesk files', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Demo changed\n', 'utf8')

    const result = runCli(repo, ['next', '--dry-run', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-next-v1')
    expect(report.action).toBe('auto-capture')
    expect(report.reason).toBe('dirty-no-session')
    expect(report.recommendation).toContain('auto-capture')
    expect(report.dryRun).toBe(true)
    expect(report.summary).toContain('would capture local git changes')
    expect(report.commands).toEqual(['forgedesk next'])
    expect(existsSync(path.join(repo, '.forgedesk'))).toBe(false)
  })

  it('runs next to generate evidence for an active session without evidence', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Next evidence']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Generate evidence through next.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed next output.']).status).toBe(0)

    const result = runCli(repo, ['next'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Action: generate-evidence')
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(existsSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'evidence.json'))).toBe(true)
  })

  it('previews evidence generation with next --dry-run without writing evidence', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Next evidence dry run']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Preview evidence generation through next.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed next dry-run output.']).status).toBe(0)

    const result = runCli(repo, ['next', '--dry-run'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Action: generate-evidence')
    expect(result.stdout).toContain('Dry run: yes')
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(existsSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'evidence.json'))).toBe(false)
  })

  it('runs next to refresh stale evidence before readiness/export', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Next stale evidence']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Refresh stale evidence through next.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)
    expect(runCli(repo, ['check', 'Recorded after evidence generation.']).status).toBe(0)

    const result = runCli(repo, ['next'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Action: generate-evidence')
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    const summary = readFileSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'PR_EVIDENCE.md'), 'utf8')
    expect(summary).toContain('Recorded after evidence generation.')
  })

  it('refreshes evidence when tracked file content changes without changing the file list', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Next fingerprint refresh']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Refresh stale evidence when content changes.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed initial evidence.']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# First dirty content\n', 'utf8')
    expect(runCli(repo, ['evidence']).status).toBe(0)
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    const originalSession = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'sessions', `${sessionId}.json`), 'utf8'))
    const originalFingerprint = originalSession.gitSnapshot.diffFingerprint

    writeFileSync(path.join(repo, 'README.md'), '# Changed dirty content\n', 'utf8')
    const preview = runCli(repo, ['next', '--dry-run', '--json'])

    expect(preview.status).toBe(0)
    const previewReport = JSON.parse(preview.stdout)
    expect(previewReport.action).toBe('generate-evidence')
    expect(previewReport.reason).toBe('stale-evidence')
    expect(previewReport.recommendation).toContain('generate evidence')
    expect(previewReport.evidenceFresh).toBe(false)
    expect(previewReport.session.id).toBe(sessionId)

    const result = runCli(repo, ['next'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Action: generate-evidence')
    expect(result.stdout).toContain('Evidence fresh: yes')
    const refreshedSession = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'sessions', `${sessionId}.json`), 'utf8'))
    expect(refreshedSession.gitSnapshot.diffFingerprint).toBeTruthy()
    expect(refreshedSession.gitSnapshot.diffFingerprint).not.toBe(originalFingerprint)
    expect(refreshedSession.id).toBe(sessionId)
  })

  it('runs next to export ready evidence', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Next export']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Export ready evidence through next.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed ready evidence.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['next'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Action: export')
    expect(result.stdout).toContain('Reason: exported')
    expect(result.stdout).toContain('Recommended next:')
    expect(result.stdout).toContain('Ready: yes')
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(existsSync(path.join(repo, '.forgedesk', 'exports', sessionId, 'HANDOFF.md'))).toBe(true)
  })

  it('previews export with next --dry-run without writing export files', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Next export dry run']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Preview export through next.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed ready dry-run evidence.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['next', '--dry-run'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Action: export')
    expect(result.stdout).toContain('Reason: ready-to-export')
    expect(result.stdout).toContain('Dry run: yes')
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(existsSync(path.join(repo, '.forgedesk', 'exports', sessionId, 'HANDOFF.md'))).toBe(false)
  })

  it('blocks next export when evidence is not ready', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Next blocked']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Block next on failed tests.']).status).toBe(0)
    expect(runCli(repo, ['test', '--', 'node', '-e', '"process.exit(2)"']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['next'])

    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('Action: blocked')
    expect(result.stdout).toContain('Reason: failed-tests')
    expect(result.stdout).toContain('Recommended next:')
    expect(result.stdout).toContain('At least one test command failed.')
    expect(result.stdout).toContain('forgedesk fix-context')
    expect(result.stdout).toContain('## Commands')
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(existsSync(path.join(repo, '.forgedesk', 'exports', sessionId, 'HANDOFF.md'))).toBe(false)

    const fixContext = runCli(repo, ['fix-context'])
    expect(fixContext.status).toBe(0)
    expect(fixContext.stdout).toContain('# Fix Context')
    expect(fixContext.stdout).toContain('node -e')
    expect(fixContext.stdout).toContain('Keep the fix scoped')
  })

  it('prints fix context for an explicit failed session without falling back to active', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'First failed session']).status).toBe(0)
    const firstSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(runCli(repo, ['intent', 'Fix the first failed session only.']).status).toBe(0)
    expect(runCli(repo, ['test', '--', 'node', '-e', '"console.error(\'first failure\'); process.exit(2)"']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    expect(runCli(repo, ['start', '--title', 'Second active session']).status).toBe(0)

    const fixContext = runCli(repo, ['fix-context', '--session', firstSessionId])

    expect(fixContext.status).toBe(0)
    expect(fixContext.stdout).toContain('First failed session')
    expect(fixContext.stdout).toContain('first failure')
    expect(fixContext.stdout).not.toContain('Second active session')

    const activeFixContext = runCli(repo, ['fix-context'])
    expect(activeFixContext.status).not.toBe(0)
    expect(activeFixContext.stderr).toContain('no failed tests are recorded')
  })

  it('runs the full evidence workflow', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Demo changed\n', 'utf8')

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Update demo readme']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Explain the demo readme change.']).status).toBe(0)
    expect(runCli(repo, ['decision', 'Keep the change documentation-only.']).status).toBe(0)
    expect(runCli(repo, ['risk', 'README wording may need review.', '--severity', 'low']).status).toBe(0)
    expect(runCli(repo, ['check', 'Opened the rendered evidence files.']).status).toBe(0)
    expect(runCli(repo, ['test', '--command', 'npm test']).status).toBe(0)
    expect(runCli(repo, ['test', '--', 'node', '--version']).status).toBe(0)

    const status = runCli(repo, ['status'])
    expect(status.status).toBe(0)
    expect(status.stdout).toContain('ForgeDesk Status')
    expect(status.stdout).toContain('Intent: present')
    expect(status.stdout).toContain('## Next')

    const evidence = runCli(repo, ['evidence'])
    expect(evidence.status).toBe(0)

    const evidenceRoot = path.join(repo, '.forgedesk', 'evidence')
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    const evidenceDir = path.join(evidenceRoot, sessionId)
    expect(existsSync(path.join(evidenceDir, 'PR_EVIDENCE.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'SUMMARY.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'PR_BODY.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'REVIEW_CONTEXT.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'TEST_EVIDENCE.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'CHANGE_SUMMARY.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'TEST_RESULTS.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'REVIEW_PROMPT.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'evidence.json'))).toBe(true)
    const prEvidence = readFileSync(path.join(evidenceDir, 'PR_EVIDENCE.md'), 'utf8')
    expect(prEvidence).toContain('Changed files: 1')
    expect(prEvidence).toContain('- README.md')
    expect(prEvidence).toContain('Opened the rendered evidence files.')
    expect(evidence.stdout).toContain('Generated evidence')
    const session = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'sessions', `${sessionId}.json`), 'utf8'))
    expect(session.status).toBe('needs-review')

    const customEvidence = runCli(repo, ['evidence', '--output-dir', 'custom-evidence'])
    expect(customEvidence.status).toBe(0)
    expect(existsSync(path.join(repo, 'custom-evidence', 'PR_EVIDENCE.md'))).toBe(true)

    const evidenceList = runCli(repo, ['evidence', '--list'])
    expect(evidenceList.status).toBe(0)
    expect(evidenceList.stdout).toContain('ForgeDesk Evidence Packs')
    expect(evidenceList.stdout).toContain('custom-evidence')
    expect(evidenceList.stdout).toContain('Update demo readme')

    const latestEvidence = runCli(repo, ['evidence', '--latest'])
    expect(latestEvidence.status).toBe(0)
    expect(latestEvidence.stdout).toContain('Latest ForgeDesk Evidence')
    expect(latestEvidence.stdout).toContain('Evidence: custom-evidence')

    const invalidDiscovery = runCli(repo, ['evidence', '--latest', '--session', sessionId])
    expect(invalidDiscovery.status).not.toBe(0)
    expect(invalidDiscovery.stderr).toContain('Use --list or --latest without --session or --output-dir')
  })

  it('generates evidence for an explicit session id', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'First change']).status).toBe(0)
    const firstSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
      .activeSessionId
    expect(runCli(repo, ['intent', 'Review the first change.']).status).toBe(0)

    expect(runCli(repo, ['start', '--title', 'Second change']).status).toBe(0)

    const sessions = runCli(repo, ['sessions'])
    expect(sessions.status).toBe(0)
    expect(sessions.stdout).toContain('ForgeDesk Sessions')
    expect(sessions.stdout).toContain('First change')
    expect(sessions.stdout).toContain('Second change')
    expect(sessions.stdout).toContain('* ')

    const result = runCli(repo, [
      'evidence',
      '--session',
      firstSessionId,
      '--output-dir',
      'first-session-evidence'
    ])

    expect(result.status).toBe(0)
    const prEvidence = readFileSync(path.join(repo, 'first-session-evidence', 'PR_EVIDENCE.md'), 'utf8')
    expect(prEvidence).toContain('First change')
    expect(prEvidence).toContain('Review the first change.')
    expect(prEvidence).not.toContain('Second change')
  })

  it('supports session lifecycle and show output', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Lifecycle demo\n', 'utf8')

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Lifecycle first']).status).toBe(0)
    const firstSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
      .activeSessionId
    expect(runCli(repo, ['intent', 'Exercise session lifecycle.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Read generated evidence files.']).status).toBe(0)
    expect(runCli(repo, ['test', '--command', 'pnpm test']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const show = runCli(repo, ['show'])
    expect(show.status).toBe(0)
    expect(show.stdout).toContain('ForgeDesk Session')
    expect(show.stdout).toContain('Exercise session lifecycle.')
    expect(show.stdout).toContain('Read generated evidence files.')
    expect(show.stdout).toContain('Evidence: .forgedesk')
    expect(show.stdout).not.toContain('.forgedesk\\evidence')

    expect(runCli(repo, ['done']).status).toBe(0)
    const doneSessions = runCli(repo, ['sessions', '--status', 'done'])
    expect(doneSessions.status).toBe(0)
    expect(doneSessions.stdout).toContain('Lifecycle first')
    expect(doneSessions.stdout).toContain('| done |')

    expect(runCli(repo, ['archive', '--session', firstSessionId]).status).toBe(0)
    expect(runCli(repo, ['sessions']).stdout).not.toContain('Lifecycle first')
    const allSessions = runCli(repo, ['sessions', '--all'])
    expect(allSessions.status).toBe(0)
    expect(allSessions.stdout).toContain('Filter: all')
    expect(allSessions.stdout).toContain('Lifecycle first')
    expect(allSessions.stdout).toContain('| archived |')
    const archivedSessions = runCli(repo, ['sessions', '--status', 'archived'])
    expect(archivedSessions.stdout).toContain('Lifecycle first')
    const archivedShow = runCli(repo, ['show', '--session', firstSessionId])
    expect(archivedShow.status).toBe(0)
    expect(archivedShow.stdout).toContain('Lifecycle first')
    expect(archivedShow.stdout).toContain('Status: archived')
    expect(archivedShow.stdout).toContain(firstSessionId)

    expect(runCli(repo, ['reopen', '--session', firstSessionId]).status).toBe(0)
    const config = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
    expect(config.activeSessionId).toBe(firstSessionId)
    const activeSessions = runCli(repo, ['sessions', '--status', 'active'])
    expect(activeSessions.stdout).toContain('Lifecycle first')
    expect(activeSessions.stdout).toContain('* ')
  })

  it('checks local project health with doctor', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    const initialDoctor = runCli(repo, ['doctor'])
    expect(initialDoctor.status).toBe(0)
    expect(initialDoctor.stdout).toContain('ForgeDesk Doctor')
    expect(initialDoctor.stdout).toContain('Status: warning')
    expect(initialDoctor.stdout).toContain('No active session configured')

    expect(runCli(repo, ['start', '--title', 'Doctor demo']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Exercise doctor command.']).status).toBe(0)
    expect(runCli(repo, ['test', '--command', 'pnpm test']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const doctorJson = runCli(repo, ['doctor', '--json'])
    expect(doctorJson.status).toBe(0)
    const report = JSON.parse(doctorJson.stdout)
    expect(report.schemaVersion).toBe('forgedesk-doctor-v1')
    expect(report.status).toBe('ok')
    expect(report.recommendation).toContain('forgedesk next')
    expect(report.activeSession.title).toBe('Doctor demo')
    expect(report.checks.some((item: { name: string; status: string }) => item.name === 'evidence' && item.status === 'ok')).toBe(true)
    expect(report.checks.some((item: { name: string; status: string }) => item.name === 'activeEvidence' && item.status === 'ok')).toBe(true)

    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    writeFileSync(path.join(repo, 'README.md'), '# Demo changed after evidence\n', 'utf8')
    const staleDoctor = runCli(repo, ['doctor', '--json'])
    expect(staleDoctor.status).toBe(0)
    const staleReport = JSON.parse(staleDoctor.stdout)
    expect(staleReport.status).toBe('warning')
    expect(staleReport.recommendation).toContain('generate or refresh evidence')
    expect(staleReport.checks.some((item: { name: string; status: string }) => item.name === 'activeEvidence' && item.status === 'warning')).toBe(true)

    rmSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'PR_EVIDENCE.md'))
    const brokenDoctor = runCli(repo, ['doctor'])
    expect(brokenDoctor.status).not.toBe(0)
    expect(brokenDoctor.stdout).toContain('Status: error')
    expect(brokenDoctor.stdout).toContain('Recommended next: Fix the error checks above')
    expect(brokenDoctor.stdout).toContain('missing PR_EVIDENCE.md')
  })

  it('summarizes historical evidence issues without failing the active session', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Old doctor evidence']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Create older evidence.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed older evidence.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)
    const oldSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    rmSync(path.join(repo, '.forgedesk', 'evidence', oldSessionId, 'PR_EVIDENCE.md'))

    expect(runCli(repo, ['start', '--title', 'Current doctor evidence']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Keep current evidence healthy.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed current evidence.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const doctor = runCli(repo, ['doctor', '--json'])
    expect(doctor.status).toBe(0)
    const report = JSON.parse(doctor.stdout)
    expect(report.status).toBe('warning')
    expect(report.checks.some((item: { name: string; status: string }) => item.name === 'historicalEvidence' && item.status === 'warning')).toBe(true)
    expect(report.checks.some((item: { name: string; status: string }) => item.name === 'evidence' && item.status === 'error')).toBe(false)
  })

  it('checks evidence readiness for handoff', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Ready demo']).status).toBe(0)

    const notReady = runCli(repo, ['ready'])
    expect(notReady.status).not.toBe(0)
    expect(notReady.stdout).toContain('ForgeDesk Ready')
    expect(notReady.stdout).toContain('Ready: no')
    expect(notReady.stdout).toContain('Intent is missing.')
    expect(notReady.stdout).toContain('Evidence has not been generated.')

    expect(runCli(repo, ['intent', 'Exercise ready command.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Opened the generated evidence files.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const readyJson = runCli(repo, ['ready', '--json'])
    expect(readyJson.status).toBe(0)
    const report = JSON.parse(readyJson.stdout)
    expect(report.schemaVersion).toBe('forgedesk-ready-v1')
    expect(report.ready).toBe(true)
    expect(report.warnings).toContain('No command tests recorded; readiness relies on manual checks.')

    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    rmSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'TEST_RESULTS.md'))
    const brokenReady = runCli(repo, ['ready', '--session', sessionId])
    expect(brokenReady.status).not.toBe(0)
    expect(brokenReady.stdout).toContain('Ready: no')
    expect(brokenReady.stdout).toContain('Evidence pack is missing: TEST_RESULTS.md.')
  })

  it('prints a local handoff summary for a session', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Handoff demo\n', 'utf8')

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Handoff demo']).status).toBe(0)
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(runCli(repo, ['intent', 'Exercise handoff command.']).status).toBe(0)
    expect(runCli(repo, ['decision', 'Keep handoff as a read-only summary.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed the generated evidence files.']).status).toBe(0)
    expect(runCli(repo, ['test', '--', 'node', '--version']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const handoff = runCli(repo, ['handoff'])
    expect(handoff.status).toBe(0)
    expect(handoff.stdout).toContain('ForgeDesk Handoff')
    expect(handoff.stdout).toContain('Ready: yes')
    expect(handoff.stdout).toContain('Intent: Exercise handoff command.')
    expect(handoff.stdout).toContain('PR_EVIDENCE.md')
    expect(handoff.stdout).toContain('REVIEW_PROMPT.md')
    expect(handoff.stdout).toContain('Changed files: 1')
    expect(handoff.stdout).toContain('## Suggested Review Order')
    expect(handoff.stdout).toContain('## Commands')
    expect(handoff.stdout).toContain(`forgedesk review-context --session ${sessionId}`)
    expect(handoff.stdout).not.toContain('.forgedesk\\evidence')

    const json = runCli(repo, ['handoff', '--session', sessionId, '--json'])
    expect(json.status).toBe(0)
    const report = JSON.parse(json.stdout)
    expect(report.schemaVersion).toBe('forgedesk-handoff-v1')
    expect(report.ready.ready).toBe(true)
    expect(report.suggestedReviewOrder).toContain('.forgedesk/evidence/' + sessionId + '/REVIEW_CONTEXT.md')
    expect(report.commands).toContain('forgedesk pr --session ' + sessionId)
    expect(report.recommendedFiles).toContain('.forgedesk/evidence/' + sessionId + '/PR_EVIDENCE.md')
  })

  it('prints handoff blockers without requiring ready evidence', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Not ready handoff']).status).toBe(0)

    const handoff = runCli(repo, ['handoff'])

    expect(handoff.status).toBe(0)
    expect(handoff.stdout).toContain('Ready: no')
    expect(handoff.stdout).toContain('Intent is missing.')
    expect(handoff.stdout).toContain('Generate evidence before handoff.')
  })

  it('exports a local evidence pack with a handoff file', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Export demo\n', 'utf8')

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Export demo']).status).toBe(0)
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(runCli(repo, ['intent', 'Exercise export command.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed the generated evidence files.']).status).toBe(0)
    expect(runCli(repo, ['test', '--', 'node', '--version']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['export'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ForgeDesk Export')
    expect(result.stdout).toContain('Ready: yes')
    expect(result.stdout).toContain('HANDOFF.md')

    const defaultExportDir = path.join(repo, '.forgedesk', 'exports', sessionId)
    expect(existsSync(path.join(defaultExportDir, 'PR_EVIDENCE.md'))).toBe(true)
    expect(existsSync(path.join(defaultExportDir, 'TEST_RESULTS.md'))).toBe(true)
    expect(existsSync(path.join(defaultExportDir, 'REVIEW_PROMPT.md'))).toBe(true)
    expect(existsSync(path.join(defaultExportDir, 'CHANGE_SUMMARY.md'))).toBe(true)
    expect(existsSync(path.join(defaultExportDir, 'evidence.json'))).toBe(true)
    const handoff = readFileSync(path.join(defaultExportDir, 'HANDOFF.md'), 'utf8')
    expect(handoff).toContain('ForgeDesk Handoff')
    expect(handoff).toContain('Exercise export command.')

    const custom = runCli(repo, ['export', '--session', sessionId, '--output-dir', 'handoff-export', '--json'])
    expect(custom.status).toBe(0)
    const report = JSON.parse(custom.stdout)
    expect(report.schemaVersion).toBe('forgedesk-export-v1')
    expect(report.ready).toBe(true)
    expect(report.outputDir).toContain('handoff-export')
    expect(report.files.some((file: string) => file.endsWith('/HANDOFF.md'))).toBe(true)
    expect(existsSync(path.join(repo, 'handoff-export', 'HANDOFF.md'))).toBe(true)
  })

  it('inspects evidence and export files for a session', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Inspect demo\n', 'utf8')

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Inspect first']).status).toBe(0)
    const firstSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(runCli(repo, ['intent', 'Exercise inspect for an explicit session.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed evidence files.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)
    expect(runCli(repo, ['export']).status).toBe(0)

    expect(runCli(repo, ['start', '--title', 'Inspect second']).status).toBe(0)

    const inspect = runCli(repo, ['inspect', '--session', firstSessionId])
    expect(inspect.status).toBe(0)
    expect(inspect.stdout).toContain('ForgeDesk Inspect')
    expect(inspect.stdout).toContain('OK: yes')
    expect(inspect.stdout).toContain('Target: evidence')
    expect(inspect.stdout).toContain('PR_EVIDENCE.md')
    expect(inspect.stdout).toContain('bytes')

    const inspectJson = runCli(repo, ['inspect', '--session', firstSessionId, '--json'])
    expect(inspectJson.status).toBe(0)
    const report = JSON.parse(inspectJson.stdout)
    expect(report.schemaVersion).toBe('forgedesk-inspect-v1')
    expect(report.target).toBe('evidence')
    expect(report.ok).toBe(true)
    expect(report.files.some((file: { name: string; exists: boolean }) => file.name === 'PR_EVIDENCE.md' && file.exists)).toBe(true)

    const exportInspect = runCli(repo, ['inspect', '--session', firstSessionId, '--export'])
    expect(exportInspect.status).toBe(0)
    expect(exportInspect.stdout).toContain('Target: export')
    expect(exportInspect.stdout).toContain('HANDOFF.md')
  })

  it('finds the ForgeDesk workspace from a repository subdirectory', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const subdir = path.join(repo, 'packages', 'demo')
    mkdirSync(subdir, { recursive: true })

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Subdirectory workspace']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Exercise workspace discovery from a child directory.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Ran read-only commands from a child directory.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    for (const args of [
      ['status'],
      ['sessions'],
      ['show'],
      ['ready'],
      ['handoff'],
      ['inspect']
    ]) {
      const result = runCli(subdir, args)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Subdirectory workspace')
    }
  })

  it('resolves active, explicit, and unknown sessions for handoff commands', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'First resolved session']).status).toBe(0)
    const firstSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
      .activeSessionId
    expect(runCli(repo, ['intent', 'Exercise explicit session resolution.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed generated evidence.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)
    expect(runCli(repo, ['export']).status).toBe(0)

    expect(runCli(repo, ['start', '--title', 'Second active session']).status).toBe(0)
    const secondSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
      .activeSessionId

    const activeReady = runCli(repo, ['ready'])
    expect(activeReady.status).not.toBe(0)
    expect(activeReady.stdout).toContain(`Session ID: ${secondSessionId}`)
    expect(activeReady.stdout).not.toContain(`Session ID: ${firstSessionId}`)

    for (const args of [
      ['ready', '--session', firstSessionId],
      ['handoff', '--session', firstSessionId],
      ['export', '--session', firstSessionId, '--output-dir', 'first-session-export'],
      ['inspect', '--session', firstSessionId, '--export'],
      ['show', '--session', firstSessionId]
    ]) {
      const result = runCli(repo, args)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain(firstSessionId)
      expect(result.stdout).not.toContain(secondSessionId)
    }

    const reviewContext = runCli(repo, ['review-context', '--session', firstSessionId])
    expect(reviewContext.status).toBe(0)
    expect(reviewContext.stdout).toContain('Exercise explicit session resolution.')
    expect(reviewContext.stdout).not.toContain('Second active session')

    const prBody = runCli(repo, ['pr', '--session', firstSessionId])
    expect(prBody.status).toBe(0)
    expect(prBody.stdout).toContain('Exercise explicit session resolution.')
    expect(prBody.stdout).not.toContain('Second active session')

    for (const args of [
      ['ready', '--session', 'missing-session'],
      ['handoff', '--session', 'missing-session'],
      ['review-context', '--session', 'missing-session'],
      ['pr', '--session', 'missing-session'],
      ['export', '--session', 'missing-session'],
      ['inspect', '--session', 'missing-session'],
      ['show', '--session', 'missing-session'],
      ['reopen', '--session', 'missing-session']
    ]) {
      const result = runCli(repo, args)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('Unknown session: missing-session')
    }
  })

  it('reports inspect errors for missing evidence and missing files', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Inspect missing evidence']).status).toBe(0)

    const missingEvidence = runCli(repo, ['inspect'])
    expect(missingEvidence.status).not.toBe(0)
    expect(missingEvidence.stderr).toContain('Cannot inspect because evidence has not been generated')

    expect(runCli(repo, ['intent', 'Exercise inspect missing files.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed evidence files.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    rmSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'PR_EVIDENCE.md'))

    const missingFile = runCli(repo, ['inspect'])
    expect(missingFile.status).not.toBe(0)
    expect(missingFile.stdout).toContain('OK: no')
    expect(missingFile.stdout).toContain('missing: PR_EVIDENCE.md')
    expect(missingFile.stdout).toContain('## Missing Files')
  })

  it('reports export errors before evidence generation', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Missing export evidence']).status).toBe(0)

    const result = runCli(repo, ['export'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Cannot export because evidence has not been generated')

    const reviewContext = runCli(repo, ['review-context'])
    expect(reviewContext.status).not.toBe(0)
    expect(reviewContext.stderr).toContain('Cannot read review context because evidence has not been generated')

    const prBody = runCli(repo, ['pr'])
    expect(prBody.status).not.toBe(0)
    expect(prBody.stderr).toContain('Cannot read PR body because evidence has not been generated')
  })

  it('blocks readiness when a test command failed', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Failed ready demo']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Record a failed test.']).status).toBe(0)
    expect(runCli(repo, ['test', '--', 'node', '-e', '"process.exit(2)"']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const ready = runCli(repo, ['ready'])

    expect(ready.status).not.toBe(0)
    expect(ready.stdout).toContain('Ready: no')
    expect(ready.stdout).toContain('At least one test command failed.')
  })

  it('reports lifecycle command errors clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const showMissing = runCli(repo, ['show'])
    expect(showMissing.status).not.toBe(0)
    expect(showMissing.stderr).toContain('No active change session')

    const archiveMissing = runCli(repo, ['archive'])
    expect(archiveMissing.status).not.toBe(0)
    expect(archiveMissing.stderr).toContain("required option '--session")

    const unknown = runCli(repo, ['reopen', '--session', 'missing-session'])
    expect(unknown.status).not.toBe(0)
    expect(unknown.stderr).toContain('Unknown session')

    const badStatus = runCli(repo, ['sessions', '--status', 'closed'])
    expect(badStatus.status).not.toBe(0)
    expect(badStatus.stderr).toContain('Session status must be one of')

    const emptyEvidence = runCli(repo, ['evidence', '--latest'])
    expect(emptyEvidence.status).not.toBe(0)
    expect(emptyEvidence.stderr).toContain('No ForgeDesk evidence packs yet')
  })

  it('reports invalid project metadata clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, '.forgedesk', 'project.json'), '{ invalid json', 'utf8')

    const result = runCli(repo, ['status'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Could not read ForgeDesk project metadata')
    expect(result.stderr).toContain('invalid JSON')
  })

  it('reports invalid config metadata clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    const configPath = path.join(repo, '.forgedesk', 'config.json')
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    writeFileSync(configPath, JSON.stringify({ ...config, schemaVersion: 'forgedesk-config-v0' }, null, 2), 'utf8')

    const result = runCli(repo, ['status'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Invalid ForgeDesk config metadata')
    expect(result.stderr).toContain('schemaVersion must be forgedesk-config-v1')
  })

  it('reports invalid session schema clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Invalid schema demo']).status).toBe(0)
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    const sessionPath = path.join(repo, '.forgedesk', 'sessions', `${sessionId}.json`)
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    writeFileSync(sessionPath, JSON.stringify({ ...session, schemaVersion: 'forgedesk-session-v0' }, null, 2), 'utf8')

    const result = runCli(repo, ['show'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Invalid ForgeDesk session metadata')
    expect(result.stderr).toContain('schemaVersion must be forgedesk-session-v1')
  })

  it('reports missing required session fields clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Missing field demo']).status).toBe(0)
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    const sessionPath = path.join(repo, '.forgedesk', 'sessions', `${sessionId}.json`)
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    delete session.tests
    writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf8')

    const result = runCli(repo, ['show'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Invalid ForgeDesk session metadata')
    expect(result.stderr).toContain('tests must be an array')
  })

  it('reads session metadata when optional fields are absent', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Optional fields demo']).status).toBe(0)
    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    const sessionPath = path.join(repo, '.forgedesk', 'sessions', `${sessionId}.json`)
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    delete session.intent
    delete session.manualChecks
    delete session.gitSnapshot
    delete session.evidenceDir
    writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf8')

    const result = runCli(repo, ['show'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Optional fields demo')
    expect(result.stdout).toContain('Intent: Not recorded.')
  })

  it('records failing command exit codes', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Failing test demo']).status).toBe(0)
    const result = runCli(repo, ['test', '--', 'node', '-e', '"process.exit(2)"'])
    expect(result.status).toBe(0)

    const sessionDir = path.join(repo, '.forgedesk', 'sessions')
    const sessionFile = path.join(sessionDir, readdirSync(sessionDir)[0]!)
    const session = JSON.parse(readFileSync(sessionFile, 'utf8'))
    expect(session.tests[0].status).toBe('failed')
    expect(session.tests[0].exitCode).toBe(2)
    expect(session.tests[0].logFile).toContain('.forgedesk/logs/')
    expect(session.tests[0].logFile).not.toContain('\\')
  })

  it('records executed tests on the session that was active when the command started', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'First test session']).status).toBe(0)
    const firstSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
      .activeSessionId

    expect(runCli(repo, ['start', '--title', 'Second test session']).status).toBe(0)
    const secondSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
      .activeSessionId
    expect(runCli(repo, ['reopen', '--session', firstSessionId]).status).toBe(0)

    writeFileSync(
      path.join(repo, 'switch-active.js'),
      [
        "const fs = require('node:fs')",
        "const path = require('node:path')",
        "const configPath = path.join(process.cwd(), '.forgedesk', 'config.json')",
        "const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))",
        `config.activeSessionId = ${JSON.stringify(secondSessionId)}`,
        "fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\\n`, 'utf8')"
      ].join('\n'),
      'utf8'
    )

    const result = runCli(repo, ['test', '--', 'node', 'switch-active.js'])
    expect(result.status).toBe(0)

    const firstSession = JSON.parse(
      readFileSync(path.join(repo, '.forgedesk', 'sessions', `${firstSessionId}.json`), 'utf8')
    )
    const secondSession = JSON.parse(
      readFileSync(path.join(repo, '.forgedesk', 'sessions', `${secondSessionId}.json`), 'utf8')
    )
    const config = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))

    expect(config.activeSessionId).toBe(secondSessionId)
    expect(firstSession.tests).toHaveLength(1)
    expect(firstSession.tests[0].command).toBe('node switch-active.js')
    expect(secondSession.tests).toHaveLength(0)
  })

  it('rejects invalid risk severity values', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Severity demo']).status).toBe(0)

    const result = runCli(repo, ['risk', 'Invalid severity', '--severity', 'critical'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Risk severity must be one of')
  })

  it('rejects blank record text', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Blank text demo']).status).toBe(0)

    for (const [command, message] of [
      ['intent', 'Intent text is required.'],
      ['decision', 'Decision text is required.'],
      ['risk', 'Risk text is required.'],
      ['check', 'Manual check text is required.']
    ]) {
      const result = runCli(repo, [command, '   '])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(message)
    }
  })

  it('reports non-git init errors clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    mkdirSync(repo, { recursive: true })

    const result = runCli(repo, ['init', '--repo', '.'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('not a git repository')
  })

  it('reports missing ForgeDesk project errors clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    const status = runCli(repo, ['status'])
    const evidence = runCli(repo, ['evidence'])

    expect(status.status).not.toBe(0)
    expect(status.stderr).toContain('Could not find a ForgeDesk project')
    expect(evidence.status).not.toBe(0)
    expect(evidence.stderr).toContain('Could not find a ForgeDesk project')
  })

  it('reports missing active session errors clearly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    for (const args of [
      ['intent', 'Need a session'],
      ['decision', 'Need a session'],
      ['risk', 'Need a session'],
      ['check', 'Need a session'],
      ['test', '--command', 'npm test']
    ]) {
      const result = runCli(repo, args)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('No active change session')
    }
  })

  it('generates a local context file for the active session', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Context demo']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Generate AI-friendly context.']).status).toBe(0)
    expect(runCli(repo, ['decision', 'Keep context as a single file.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed context output.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['context'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ForgeDesk Context')
    expect(result.stdout).toContain('CONTEXT.md')
    expect(result.stdout).toContain('Context demo')
    expect(result.stdout).toContain('Ready: yes')

    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    const contextPath = path.join(repo, '.forgedesk', 'CONTEXT.md')
    expect(existsSync(contextPath)).toBe(true)
    const content = readFileSync(contextPath, 'utf8')
    expect(content).toContain('# ForgeDesk Context')
    expect(content).toContain('Generate AI-friendly context.')
    expect(content).toContain('Keep context as a single file.')
    expect(content).toContain('## Git')
    expect(content).toContain('## Tests')
    expect(content).toContain('## Readiness')
    expect(content).toContain('## Boundary')
  })

  it('outputs context report as JSON', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Context JSON']).status).toBe(0)
    expect(runCli(repo, ['intent', 'JSON context output.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed JSON output.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['context', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-context-v1')
    expect(report.ready).toBe(true)
    expect(report.session.title).toBe('Context JSON')
    expect(report.path).toContain('CONTEXT.md')
  })

  it('generates context for an explicit session', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'First context']).status).toBe(0)
    const firstSessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    expect(runCli(repo, ['intent', 'First session context.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed first context.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    expect(runCli(repo, ['start', '--title', 'Second context']).status).toBe(0)

    const result = runCli(repo, ['context', '--session', firstSessionId, '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.session.id).toBe(firstSessionId)
    expect(report.session.title).toBe('First context')
  })

  it('includes evidence score in doctor output', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Score doctor']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Test evidence score in doctor.']).status).toBe(0)
    expect(runCli(repo, ['decision', 'Record a decision.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed output.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['doctor', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.evidenceScore).toBeDefined()
    expect(report.evidenceScore.total).toBeGreaterThanOrEqual(4)
    expect(report.evidenceScore.max).toBe(7)
    expect(report.evidenceScore.percent).toBeGreaterThanOrEqual(57)
    expect(report.evidenceScore.dimensions).toHaveLength(7)
    expect(report.evidenceScore.dimensions.find((d: any) => d.name === 'intent').score).toBe(1)
    expect(report.evidenceScore.dimensions.find((d: any) => d.name === 'decisions').score).toBe(1)
  })

  it('includes evidence score in now output', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Score now']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Test evidence score in now.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['now', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.evidenceScore).toBeDefined()
    expect(report.evidenceScore.max).toBe(7)
  })

  it('includes evidence score in next output', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Score next']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Test evidence score in next.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['next', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.evidenceScore).toBeDefined()
    expect(report.evidenceScore.max).toBe(7)
  })

  it('supports status in a git repo with no commits', () => {
    const repo = tempDir()
    dirs.push(repo)
    initEmptyGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Unborn head demo']).status).toBe(0)

    const status = runCli(repo, ['status'])

    expect(status.status).toBe(0)
    expect(status.stdout).toContain('HEAD: unborn')
    expect(status.stdout).toContain('Next')
  })
})
