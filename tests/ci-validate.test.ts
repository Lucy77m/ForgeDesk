import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateEvidence } from '../src/core/ci-validate.js'
import { pathsFor } from '../src/core/workspace.js'
import { cleanupDir, createSessionWithEvidence, initGitRepo, runCli, tempDir } from './helpers.js'

describe('ci validate', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('passes for a valid evidence pack', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, {
      intent: 'Valid evidence.',
      tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }]
    })

    const sessionPath = path.join(pathsFor(repo).sessionsDir, 'test-session-001.json')
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    const checks = await validateEvidence(repo, session)

    expect(checks.every((c) => c.ok)).toBe(true)
    expect(checks.find((c) => c.name === 'schemaVersion')!.ok).toBe(true)
    expect(checks.find((c) => c.name === 'project')!.ok).toBe(true)
    expect(checks.find((c) => c.name === 'session')!.ok).toBe(true)
    expect(checks.find((c) => c.name === 'gitSnapshot')!.ok).toBe(true)
    expect(checks.find((c) => c.name === 'evidenceFiles')!.ok).toBe(true)
  })

  it('fails when evidence.json is missing', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { skipEvidenceFiles: true })

    // Remove evidence.json specifically
    const evidenceDir = path.join(pathsFor(repo).evidenceDir, 'test-session-001')
    rmSync(path.join(evidenceDir, 'evidence.json'), { force: true })

    const sessionPath = path.join(pathsFor(repo).sessionsDir, 'test-session-001.json')
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    const checks = await validateEvidence(repo, session)

    expect(checks.find((c) => c.name === 'evidenceJson')!.ok).toBe(false)
  })

  it('fails when evidence.json has wrong schemaVersion', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo)

    const evidenceJsonPath = path.join(pathsFor(repo).evidenceDir, 'test-session-001', 'evidence.json')
    const bundle = JSON.parse(readFileSync(evidenceJsonPath, 'utf8'))
    bundle.schemaVersion = 'wrong-version'
    writeFileSync(evidenceJsonPath, JSON.stringify(bundle, null, 2), 'utf8')

    const sessionPath = path.join(pathsFor(repo).sessionsDir, 'test-session-001.json')
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    const checks = await validateEvidence(repo, session)

    expect(checks.find((c) => c.name === 'schemaVersion')!.ok).toBe(false)
  })

  it('fails when session has no evidenceDir', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { skipEvidenceFiles: true })

    const sessionPath = path.join(pathsFor(repo).sessionsDir, 'test-session-001.json')
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    delete session.evidenceDir
    const checks = await validateEvidence(repo, session)

    expect(checks.find((c) => c.name === 'evidenceDir')!.ok).toBe(false)
  })

  it('fails when evidence files are missing', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { skipEvidenceFiles: true })

    const sessionPath = path.join(pathsFor(repo).sessionsDir, 'test-session-001.json')
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    const checks = await validateEvidence(repo, session)

    // evidence.json is also missing, so validation stops early
    expect(checks.find((c) => c.name === 'evidenceJson')!.ok).toBe(false)
  })

  it('validates through CLI', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Validate test']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Test validate.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    const result = runCli(repo, ['ci', 'validate', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-ci-validate-v1')
    expect(report.status).toBe('pass')
    expect(report.checks.length).toBeGreaterThan(5)
  })
})
