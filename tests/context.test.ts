import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getContextReport, refreshContextFile, renderContextReport } from '../src/core/context.js'
import { pathsFor } from '../src/core/workspace.js'
import { cleanupDir, createSessionWithEvidence, initGitRepo, tempDir } from './helpers.js'

describe('context', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('generates a context report for a session with evidence', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Test context generation.',
      tests: [{ id: 't1', command: 'pnpm test', status: 'passed', exitCode: 0 }]
    })

    const report = await getContextReport(repo, { sessionId })

    expect(report.schemaVersion).toBe('forgedesk-context-v1')
    expect(report.repoPath).toBe(repo)
    expect(report.path).toContain('CONTEXT.md')
    expect(report.session.id).toBe(sessionId)
    expect(report.session.title).toBe('Test session')
    expect(report.session.intent).toBe('Test context generation.')
    expect(report.ready).toBe(true)
    expect(report.blockers).toHaveLength(0)
  })

  it('writes CONTEXT.md with full content', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, {
      intent: 'Write context file.',
      tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }],
      decisions: [{ id: 'd1', text: 'Keep it simple.', createdAt: '2026-06-17T00:00:00.000Z' }],
      risks: [{ id: 'r1', text: 'Low risk.', severity: 'low', createdAt: '2026-06-17T00:00:00.000Z' }],
      manualChecks: [{ id: 'mc1', text: 'Verified output.', createdAt: '2026-06-17T00:00:00.000Z' }]
    })

    const report = await refreshContextFile(repo)

    expect(existsSync(report.path)).toBe(true)
    const content = readFileSync(report.path, 'utf8')
    expect(content).toContain('# ForgeDesk Context')
    expect(content).toContain('## Session')
    expect(content).toContain('Write context file.')
    expect(content).toContain('## Git')
    expect(content).toContain('## Changed Files')
    expect(content).toContain('## Recent Commits')
    expect(content).toContain('## Decisions')
    expect(content).toContain('Keep it simple.')
    expect(content).toContain('## Risks')
    expect(content).toContain('[low] Low risk.')
    expect(content).toContain('## Tests')
    expect(content).toContain('## Manual Checks')
    expect(content).toContain('Verified output.')
    expect(content).toContain('## Readiness')
    expect(content).toContain('Ready: yes')
    expect(content).toContain('## Next')
    expect(content).toContain('## Boundary')
    expect(content).not.toContain('.forgedesk\\')
  })

  it('reports blockers when intent is missing', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }] })

    const report = await getContextReport(repo)

    expect(report.ready).toBe(false)
    expect(report.blockers).toContain('Intent is missing.')
    expect(report.next).toContain('intent')
  })

  it('reports next action for missing evidence', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { intent: 'No tests yet.' })

    // Remove test data from session to simulate no tests
    const sessionId = 'test-session-001'
    const sessionPath = path.join(pathsFor(repo).sessionsDir, `${sessionId}.json`)
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    session.tests = []
    session.manualChecks = []
    writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8')

    const report = await getContextReport(repo, { sessionId })

    expect(report.next).toContain('test')
  })

  it('renders context report for console output', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Console render test.',
      tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }]
    })

    const report = await getContextReport(repo, { sessionId })
    const text = renderContextReport(report)

    expect(text).toContain('ForgeDesk Context')
    expect(text).toContain('CONTEXT.md')
    expect(text).toContain('Console render test.')
    expect(text).toContain('Ready: yes')
    expect(text).toContain('## Next')
    expect(text).toContain('## Blockers')
    expect(text).toContain('## Warnings')
  })

  it('resolves an explicit sessionId', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { sessionId: 'first', title: 'First', intent: 'First.' })
    createSessionWithEvidence(repo, { sessionId: 'second', title: 'Second', intent: 'Second.' })

    const report = await getContextReport(repo, { sessionId: 'first' })

    expect(report.session.id).toBe('first')
    expect(report.session.title).toBe('First')
  })
})
