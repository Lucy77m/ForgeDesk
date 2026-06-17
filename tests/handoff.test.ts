import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getHandoffReport, renderHandoffReport } from '../src/core/handoff.js'
import { pathsFor } from '../src/core/workspace.js'
import { cleanupDir, createSessionWithEvidence, initGitRepo, tempDir } from './helpers.js'

function readConfig(repo: string): any {
  return JSON.parse(readFileSync(path.join(pathsFor(repo).configFile), 'utf8'))
}

describe('handoff', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('generates a full handoff report for a session with evidence', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Test handoff report generation.',
      tests: [{ id: 't1', command: 'npm test', status: 'passed', exitCode: 0 }]
    })

    const report = await getHandoffReport(repo, sessionId)

    expect(report.schemaVersion).toBe('forgedesk-handoff-v1')
    expect(report.repoPath).toBe(repo)
    expect(report.session.id).toBe(sessionId)
    expect(report.session.title).toBe('Test session')
    expect(report.session.status).toBe('needs-review')
    expect(report.session.intent).toBe('Test handoff report generation.')
    expect(report.session.evidenceDir).toContain('.forgedesk/evidence/')
    expect(report.ready.ready).toBe(true)
    expect(report.ready.blockers).toHaveLength(0)
    expect(report.suggestedReviewOrder.length).toBe(4)
    expect(report.suggestedReviewOrder.some((p) => p.includes('REVIEW_CONTEXT.md'))).toBe(true)
    expect(report.recommendedFiles.length).toBe(9)
    expect(report.commands).toHaveLength(4)
    expect(report.commands[0]).toContain(`forgedesk review-context --session ${sessionId}`)
    expect(report.summary.tests).toContain('passed')
  })

  it('returns empty recommended and suggested lists when evidenceDir is absent', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { skipEvidenceFiles: true })

    // Remove evidenceDir from the session file
    const sessionId = 'test-session-001'
    const sessionPath = path.join(pathsFor(repo).sessionsDir, `${sessionId}.json`)
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    delete session.evidenceDir
    writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8')

    const report = await getHandoffReport(repo, sessionId)

    expect(report.recommendedFiles).toEqual([])
    expect(report.suggestedReviewOrder).toEqual([])
  })

  it('renders handoff report as formatted text', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Render test.',
      tests: [{ id: 't1', command: 'pnpm test', status: 'passed', exitCode: 0 }],
      decisions: [{ id: 'd1', text: 'Keep it simple.', createdAt: '2026-06-17T00:00:00.000Z' }],
      risks: [{ id: 'r1', text: 'Low risk.', severity: 'low', createdAt: '2026-06-17T00:00:00.000Z' }]
    })

    const report = await getHandoffReport(repo, sessionId)
    const text = renderHandoffReport(report)

    expect(text).toContain('ForgeDesk Handoff')
    expect(text).toContain('Ready: yes')
    expect(text).toContain('Render test.')
    expect(text).toContain('## Summary')
    expect(text).toContain('## Ready Blockers')
    expect(text).toContain('## Ready Warnings')
    expect(text).toContain('## Suggested Review Order')
    expect(text).toContain('## Recommended Files')
    expect(text).toContain('## Commands')
    expect(text).toContain(`forgedesk pr --session ${sessionId}`)
    expect(text).toContain('This is a local evidence handoff summary')
    expect(text).not.toContain('.forgedesk\\evidence')
  })

  it('resolves an explicit sessionId instead of falling back to active', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { sessionId: 'first', title: 'First session', intent: 'First.' })
    createSessionWithEvidence(repo, { sessionId: 'second', title: 'Second session', intent: 'Second.' })

    const report = await getHandoffReport(repo, 'first')

    expect(report.session.id).toBe('first')
    expect(report.session.title).toBe('First session')
  })

  it('throws when no active session exists and no sessionId is given', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo)

    // Clear activeSessionId
    const config = readConfig(repo)
    config.activeSessionId = undefined
    writeFileSync(pathsFor(repo).configFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

    await expect(getHandoffReport(repo)).rejects.toThrow('No active change session')
  })

  it('reports blockers when tests failed', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Test failures.',
      tests: [{ id: 't1', command: 'npm test', status: 'failed', exitCode: 1 }]
    })

    const report = await getHandoffReport(repo, sessionId)

    expect(report.ready.ready).toBe(false)
    expect(report.ready.blockers).toContain('At least one test command failed.')
  })

  it('reports blockers when no tests and no manual checks are recorded', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'No evidence yet.',
      tests: [],
    })

    const report = await getHandoffReport(repo, sessionId)

    expect(report.ready.ready).toBe(false)
    expect(report.ready.blockers).toContain('No test evidence or manual checks recorded.')
  })
})
