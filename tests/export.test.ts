import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { exportEvidencePack, renderExportReport } from '../src/core/export.js'
import { EVIDENCE_FILE_NAMES } from '../src/core/constants.js'
import { pathsFor } from '../src/core/workspace.js'
import { assertEvidenceFiles, cleanupDir, createSessionWithEvidence, initGitRepo, tempDir } from './helpers.js'

describe('export', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('exports a full evidence pack with all files and a handoff', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Export full pack.',
      tests: [{ id: 't1', command: 'pnpm test', status: 'passed', exitCode: 0 }]
    })

    const report = await exportEvidencePack(repo)

    expect(report.schemaVersion).toBe('forgedesk-export-v1')
    expect(report.ready).toBe(true)
    expect(report.session.id).toBe(sessionId)
    expect(report.session.title).toBe('Test session')
    expect(report.files.length).toBe(EVIDENCE_FILE_NAMES.length + 1)
    expect(report.files.some((f) => f.endsWith('HANDOFF.md'))).toBe(true)
    expect(report.handoffFile).toContain('HANDOFF.md')

    const exportDir = path.join(pathsFor(repo).exportsDir, sessionId)
    assertEvidenceFiles(exportDir)
    expect(existsSync(path.join(exportDir, 'HANDOFF.md'))).toBe(true)
  })

  it('throws when evidence has not been generated', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { skipEvidenceFiles: true })

    // Remove evidenceDir from session
    const sessionId = 'test-session-001'
    const sessionPath = path.join(pathsFor(repo).sessionsDir, `${sessionId}.json`)
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
    delete session.evidenceDir
    writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, 'utf8')

    await expect(exportEvidencePack(repo)).rejects.toThrow('Cannot export because evidence has not been generated')
  })

  it('throws when evidence files are missing', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Missing files test.'
    })

    // Delete one evidence file
    const evidenceDir = path.join(pathsFor(repo).evidenceDir, sessionId)
    rmSync(path.join(evidenceDir, 'PR_EVIDENCE.md'))

    await expect(exportEvidencePack(repo)).rejects.toThrow('Cannot export because evidence is missing')
  })

  it('exports to a custom outputDir', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, {
      intent: 'Custom dir export.',
      tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }]
    })

    const customDir = path.join(repo, 'my-export')
    const report = await exportEvidencePack(repo, { outputDir: customDir })

    expect(report.outputDir).toContain('my-export')
    assertEvidenceFiles(customDir)
    expect(existsSync(path.join(customDir, 'HANDOFF.md'))).toBe(true)
  })

  it('renders export report as formatted text', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createSessionWithEvidence(repo, {
      intent: 'Render export.',
      tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }]
    })

    const report = await exportEvidencePack(repo)
    const text = renderExportReport(report)

    expect(text).toContain('ForgeDesk Export')
    expect(text).toContain('Ready: yes')
    expect(text).toContain('Test session')
    expect(text).toContain(sessionId)
    expect(text).toContain('HANDOFF.md')
    expect(text).toContain('## Files')
    expect(text).toContain('This export copies local evidence files only')
  })

  it('resolves an explicit sessionId', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, { sessionId: 'first', title: 'First', intent: 'First.', tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }] })
    createSessionWithEvidence(repo, { sessionId: 'second', title: 'Second', intent: 'Second.', tests: [{ id: 't2', command: 'node --version', status: 'passed', exitCode: 0 }] })

    const report = await exportEvidencePack(repo, { sessionId: 'first' })

    expect(report.session.id).toBe('first')
    expect(report.session.title).toBe('First')
  })
})
