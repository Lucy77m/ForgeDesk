import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getReviewOutput } from '../src/core/review-output.js'
import { pathsFor, sessionFile } from '../src/core/workspace.js'
import { CONFIG_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION, SESSION_SCHEMA_VERSION } from '../src/types.js'
import { cleanupDir, tempDir } from './helpers.js'

const now = '2026-06-12T00:00:00.000Z'

function writeWorkspace(repo: string, activeSessionId: string): void {
  const paths = pathsFor(repo)
  mkdirSync(paths.sessionsDir, { recursive: true })
  mkdirSync(paths.evidenceDir, { recursive: true })
  writeFileSync(
    paths.projectFile,
    `${JSON.stringify({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      name: 'demo',
      repoPath: repo,
      createdAt: now,
      updatedAt: now
    }, null, 2)}\n`,
    'utf8'
  )
  writeFileSync(
    paths.configFile,
    `${JSON.stringify({
      schemaVersion: CONFIG_SCHEMA_VERSION,
      activeSessionId,
      createdAt: now,
      updatedAt: now
    }, null, 2)}\n`,
    'utf8'
  )
}

function writeSession(repo: string, id: string, title: string, evidenceDir?: string): void {
  writeFileSync(
    sessionFile(repo, id),
    `${JSON.stringify({
      schemaVersion: SESSION_SCHEMA_VERSION,
      id,
      title,
      status: evidenceDir ? 'needs-review' : 'active',
      decisions: [],
      risks: [],
      tests: [],
      evidenceDir,
      createdAt: now,
      updatedAt: now
    }, null, 2)}\n`,
    'utf8'
  )
}

function writeEvidence(repo: string, sessionId: string): void {
  const evidenceDir = path.join(pathsFor(repo).evidenceDir, sessionId)
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(path.join(evidenceDir, 'REVIEW_CONTEXT.md'), '# Review Context\n\nUse this.\n', 'utf8')
  writeFileSync(path.join(evidenceDir, 'PR_BODY.md'), '## Summary\n\nShip this.\n', 'utf8')
}

describe('review output helper', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('reads review context and PR body for the active session', async () => {
    const repo = tempDir()
    dirs.push(repo)
    writeWorkspace(repo, 'session-1')
    writeSession(repo, 'session-1', 'Active session', '.forgedesk/evidence/session-1')
    writeEvidence(repo, 'session-1')

    const context = await getReviewOutput(repo, { kind: 'review-context' })
    const pr = await getReviewOutput(repo, { kind: 'pr' })

    expect(context.fileName).toBe('REVIEW_CONTEXT.md')
    expect(context.text).toContain('# Review Context')
    expect(pr.fileName).toBe('PR_BODY.md')
    expect(pr.text).toContain('## Summary')
  })

  it('reads an explicit non-active session without falling back to active', async () => {
    const repo = tempDir()
    dirs.push(repo)
    writeWorkspace(repo, 'session-2')
    writeSession(repo, 'session-1', 'Explicit session', '.forgedesk/evidence/session-1')
    writeSession(repo, 'session-2', 'Active session', '.forgedesk/evidence/session-2')
    writeEvidence(repo, 'session-1')
    writeEvidence(repo, 'session-2')
    writeFileSync(path.join(pathsFor(repo).evidenceDir, 'session-1', 'REVIEW_CONTEXT.md'), '# Explicit\n', 'utf8')
    writeFileSync(path.join(pathsFor(repo).evidenceDir, 'session-2', 'REVIEW_CONTEXT.md'), '# Active\n', 'utf8')

    const output = await getReviewOutput(repo, {
      kind: 'review-context',
      sessionId: 'session-1'
    })

    expect(output.session.id).toBe('session-1')
    expect(output.text).toContain('# Explicit')
    expect(output.text).not.toContain('# Active')
  })

  it('reports missing evidence before reading files', async () => {
    const repo = tempDir()
    dirs.push(repo)
    writeWorkspace(repo, 'session-1')
    writeSession(repo, 'session-1', 'Missing evidence')

    await expect(getReviewOutput(repo, { kind: 'review-context' })).rejects.toThrow(
      'Cannot read review context because evidence has not been generated'
    )
  })
})
