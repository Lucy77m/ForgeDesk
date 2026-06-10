import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
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
    expect(result.stdout.trim()).toBe('0.1.0')
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
    expect(existsSync(path.join(evidenceDir, 'CHANGE_SUMMARY.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'TEST_RESULTS.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'REVIEW_PROMPT.md'))).toBe(true)
    expect(existsSync(path.join(evidenceDir, 'evidence.json'))).toBe(true)
    const prEvidence = readFileSync(path.join(evidenceDir, 'PR_EVIDENCE.md'), 'utf8')
    expect(prEvidence).toContain('Changed files: 1')
    expect(prEvidence).toContain('- README.md')
    expect(prEvidence).toContain('Opened the rendered evidence files.')
    expect(evidence.stdout).toContain('Generated evidence')

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
    const archivedSessions = runCli(repo, ['sessions', '--status', 'archived'])
    expect(archivedSessions.stdout).toContain('Lifecycle first')

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
    expect(report.checks.some((item: { name: string; status: string }) => item.name === 'evidence' && item.status === 'ok')).toBe(true)

    const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
    rmSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'PR_EVIDENCE.md'))
    const brokenDoctor = runCli(repo, ['doctor'])
    expect(brokenDoctor.status).not.toBe(0)
    expect(brokenDoctor.stdout).toContain('Status: error')
    expect(brokenDoctor.stdout).toContain('missing PR_EVIDENCE.md')
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
    expect(handoff.stdout).not.toContain('.forgedesk\\evidence')

    const json = runCli(repo, ['handoff', '--session', sessionId, '--json'])
    expect(json.status).toBe(0)
    const report = JSON.parse(json.stdout)
    expect(report.schemaVersion).toBe('forgedesk-handoff-v1')
    expect(report.ready.ready).toBe(true)
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
