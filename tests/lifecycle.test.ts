import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  archiveSession,
  markActiveSessionDone,
  reopenSession,
  sessionExistsWithStatus,
  showSession
} from '../src/core/lifecycle.js'
import { pathsFor } from '../src/core/workspace.js'
import { cleanupDir, createSessionWithEvidence, initGitRepo, tempDir } from './helpers.js'

function readConfig(repo: string): any {
  return JSON.parse(readFileSync(path.join(pathsFor(repo).configFile), 'utf8'))
}

describe('lifecycle', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('markActiveSessionDone transitions active session to done', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { status: 'active' })

    const updated = await markActiveSessionDone(repo)

    expect(updated.status).toBe('done')
    expect(updated.updatedAt).toBeTruthy()
    expect(updated.id).toBe('test-session-001')
  })

  it('archiveSession requires a session id', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo)

    await expect(archiveSession(repo, undefined)).rejects.toThrow('Archive requires --session <id>.')
  })

  it('archiveSession clears activeSessionId when archiving the active session', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, { status: 'active' })

    const archived = await archiveSession(repo, sessionId)

    expect(archived.status).toBe('archived')
    const config = readConfig(repo)
    expect(config.activeSessionId).toBeUndefined()
  })

  it('archiveSession does not clear activeSessionId when archiving a non-active session', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { sessionId: 'keep-active', title: 'Active', status: 'active' })
    createSessionWithEvidence(repo, { sessionId: 'to-archive', title: 'Archive me', status: 'done' })

    // Restore activeSessionId to the first session (createSessionWithEvidence overwrites it)
    let config = readConfig(repo)
    config.activeSessionId = 'keep-active'
    writeFileSync(pathsFor(repo).configFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

    const archived = await archiveSession(repo, 'to-archive')

    expect(archived.status).toBe('archived')
    config = readConfig(repo)
    expect(config.activeSessionId).toBe('keep-active')
  })

  it('reopenSession requires a session id', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo)

    await expect(reopenSession(repo, undefined)).rejects.toThrow('Reopen requires --session <id>.')
  })

  it('reopenSession sets activeSessionId and marks session active', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, { status: 'archived' })

    const reopened = await reopenSession(repo, sessionId)

    expect(reopened.status).toBe('active')
    const config = readConfig(repo)
    expect(config.activeSessionId).toBe(sessionId)
  })

  it('showSession renders full session details', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, {
      title: 'Full session',
      intent: 'Test all fields.',
      decisions: [{ id: 'd1', text: 'Keep it simple.', createdAt: '2026-06-17T00:00:00.000Z' }],
      risks: [{ id: 'r1', text: 'Low risk.', severity: 'low', createdAt: '2026-06-17T00:00:00.000Z' }],
      manualChecks: [{ id: 'mc1', text: 'Checked output.', createdAt: '2026-06-17T00:00:00.000Z' }],
      tests: [{ id: 't1', command: 'npm test', status: 'passed', exitCode: 0 }]
    })

    const output = await showSession(repo, undefined)

    expect(output).toContain('ForgeDesk Session')
    expect(output).toContain('Full session')
    expect(output).toContain('Test all fields.')
    expect(output).toContain('Keep it simple.')
    expect(output).toContain('[low] Low risk.')
    expect(output).toContain('Checked output.')
    expect(output).toContain('npm test')
    expect(output).toContain('passed')
  })

  it('showSession handles missing intent', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { title: 'No intent' })

    const output = await showSession(repo, undefined)

    expect(output).toContain('Intent: Not recorded.')
  })

  it('sessionExistsWithStatus returns true for matching and false for non-matching', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, { status: 'needs-review' })

    expect(await sessionExistsWithStatus(repo, sessionId, 'needs-review')).toBe(true)
    expect(await sessionExistsWithStatus(repo, sessionId, 'archived')).toBe(false)
    expect(await sessionExistsWithStatus(repo, 'nonexistent', 'needs-review')).toBe(false)
  })
})
