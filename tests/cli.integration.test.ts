import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    expect(runCli(repo, ['test', '--command', 'npm test']).status).toBe(0)
    expect(runCli(repo, ['test', '--', 'node', '--version']).status).toBe(0)

    const status = runCli(repo, ['status'])
    expect(status.status).toBe(0)
    expect(status.stdout).toContain('Intent: present')

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
    expect(evidence.stdout).toContain('Generated evidence')

    const customEvidence = runCli(repo, ['evidence', '--output-dir', 'custom-evidence'])
    expect(customEvidence.status).toBe(0)
    expect(existsSync(path.join(repo, 'custom-evidence', 'PR_EVIDENCE.md'))).toBe(true)
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
  })
})
