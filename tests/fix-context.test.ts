import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getFixContextReport, renderFixContext } from '../src/core/fix-context.js'
import { pathsFor, sessionFile } from '../src/core/workspace.js'
import { CONFIG_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION, SESSION_SCHEMA_VERSION } from '../src/types.js'
import { cleanupDir, tempDir } from './helpers.js'

const now = '2026-06-12T00:00:00.000Z'

function writeWorkspace(repo: string): void {
  const paths = pathsFor(repo)
  mkdirSync(paths.sessionsDir, { recursive: true })
  mkdirSync(paths.logsDir, { recursive: true })
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
      activeSessionId: 'session-1',
      createdAt: now,
      updatedAt: now
    }, null, 2)}\n`,
    'utf8'
  )
}

function writeSession(repo: string, failed: boolean): void {
  writeFileSync(
    sessionFile(repo, 'session-1'),
    `${JSON.stringify({
      schemaVersion: SESSION_SCHEMA_VERSION,
      id: 'session-1',
      title: 'Fix failing tests',
      status: 'needs-review',
      intent: 'Keep the fix scoped.',
      decisions: [],
      risks: [],
      tests: failed
        ? [{
            id: 'test-1',
            command: 'pnpm test',
            exitCode: 1,
            status: 'failed',
            summary: 'fallback summary',
            logFile: '.forgedesk/logs/test-1.log'
          }]
        : [],
      gitSnapshot: {
        branch: 'main',
        head: 'abc123',
        isDirty: true,
        modifiedFiles: ['src/app.ts'],
        addedFiles: [],
        deletedFiles: [],
        untrackedFiles: [],
        recentCommits: [],
        capturedAt: now
      },
      createdAt: now,
      updatedAt: now
    }, null, 2)}\n`,
    'utf8'
  )
}

describe('fix context', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('renders bounded failed-test context from the session log', async () => {
    const repo = tempDir()
    dirs.push(repo)
    writeWorkspace(repo)
    writeSession(repo, true)
    writeFileSync(path.join(pathsFor(repo).logsDir, 'test-1.log'), `${'failure line\n'.repeat(500)}`, 'utf8')

    const report = await getFixContextReport(repo)
    const rendered = renderFixContext(report)

    expect(report.schemaVersion).toBe('forgedesk-fix-context-v1')
    expect(rendered).toContain('# Fix Context')
    expect(rendered).toContain('src/app.ts')
    expect(rendered).toContain('pnpm test')
    expect(rendered).toContain('output truncated')
    expect(rendered.length).toBeLessThan(6000)
  })

  it('requires at least one failed test', async () => {
    const repo = tempDir()
    dirs.push(repo)
    writeWorkspace(repo)
    writeSession(repo, false)

    await expect(getFixContextReport(repo)).rejects.toThrow('no failed tests are recorded')
  })
})
