import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findRepoWithForgeDesk,
  loadWorkspace,
  pathExists,
  pathsFor,
  resolveSession,
  sessionFile
} from '../src/core/workspace.js'
import { CONFIG_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION, SESSION_SCHEMA_VERSION } from '../src/types.js'
import { cleanupDir, tempDir } from './helpers.js'

const now = '2026-06-11T00:00:00.000Z'

function writeWorkspace(repo: string): void {
  const paths = pathsFor(repo)
  mkdirSync(paths.sessionsDir, { recursive: true })
  writeFileSync(
    paths.projectFile,
    `${JSON.stringify(
      {
        schemaVersion: PROJECT_SCHEMA_VERSION,
        name: 'demo',
        repoPath: repo,
        goal: 'Exercise workspace lookup.',
        createdAt: now,
        updatedAt: now
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  writeFileSync(
    paths.configFile,
    `${JSON.stringify(
      {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        activeSessionId: 'session-1',
        createdAt: now,
        updatedAt: now
      },
      null,
      2
    )}\n`,
    'utf8'
  )
}

function writeSession(repo: string, id: string, title: string): void {
  writeFileSync(
    sessionFile(repo, id),
    `${JSON.stringify(
      {
        schemaVersion: SESSION_SCHEMA_VERSION,
        id,
        title,
        status: 'active',
        decisions: [],
        risks: [],
        tests: [],
        createdAt: now,
        updatedAt: now
      },
      null,
      2
    )}\n`,
    'utf8'
  )
}

describe('workspace helpers', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('builds workspace paths and checks existence', async () => {
    const repo = tempDir()
    dirs.push(repo)
    const paths = pathsFor(repo)

    expect(paths.forgedeskDir).toBe(path.join(repo, '.forgedesk'))
    expect(paths.projectFile).toBe(path.join(repo, '.forgedesk', 'project.json'))
    expect(paths.configFile).toBe(path.join(repo, '.forgedesk', 'config.json'))
    expect(paths.sessionsDir).toBe(path.join(repo, '.forgedesk', 'sessions'))
    expect(paths.evidenceDir).toBe(path.join(repo, '.forgedesk', 'evidence'))
    expect(paths.exportsDir).toBe(path.join(repo, '.forgedesk', 'exports'))
    expect(paths.logsDir).toBe(path.join(repo, '.forgedesk', 'logs'))
    expect(sessionFile(repo, 'session-1')).toBe(path.join(repo, '.forgedesk', 'sessions', 'session-1.json'))

    expect(await pathExists(paths.projectFile)).toBe(false)
    mkdirSync(paths.forgedeskDir, { recursive: true })
    writeFileSync(paths.projectFile, '{}\n', 'utf8')
    expect(await pathExists(paths.projectFile)).toBe(true)
  })

  it('finds a ForgeDesk workspace from the repo root and a child directory', async () => {
    const repo = tempDir()
    dirs.push(repo)
    const child = path.join(repo, 'packages', 'demo')
    mkdirSync(child, { recursive: true })
    writeWorkspace(repo)

    await expect(findRepoWithForgeDesk(repo)).resolves.toBe(repo)
    await expect(findRepoWithForgeDesk(child)).resolves.toBe(repo)
  })

  it('loads workspace metadata discovered from a child directory', async () => {
    const repo = tempDir()
    dirs.push(repo)
    const child = path.join(repo, 'src', 'feature')
    mkdirSync(child, { recursive: true })
    writeWorkspace(repo)

    const workspace = await loadWorkspace(child)

    expect(workspace.repoPath).toBe(repo)
    expect(workspace.forgedeskDir).toBe(path.join(repo, '.forgedesk'))
    expect(workspace.project.name).toBe('demo')
    expect(workspace.config.activeSessionId).toBe('session-1')
  })

  it('resolves active and explicit sessions from a discovered workspace', async () => {
    const repo = tempDir()
    dirs.push(repo)
    const child = path.join(repo, 'src', 'feature')
    mkdirSync(child, { recursive: true })
    writeWorkspace(repo)
    writeSession(repo, 'session-1', 'Active session')
    writeSession(repo, 'session-2', 'Explicit session')

    const active = await resolveSession(child)
    const explicit = await resolveSession(child, 'session-2')

    expect(active.workspace.repoPath).toBe(repo)
    expect(active.session.id).toBe('session-1')
    expect(active.session.title).toBe('Active session')
    expect(explicit.workspace.repoPath).toBe(repo)
    expect(explicit.session.id).toBe('session-2')
    expect(explicit.session.title).toBe('Explicit session')
  })

  it('reports unknown explicit sessions clearly', async () => {
    const repo = tempDir()
    dirs.push(repo)
    writeWorkspace(repo)
    writeSession(repo, 'session-1', 'Active session')

    await expect(resolveSession(repo, 'missing-session')).rejects.toThrow('Unknown session: missing-session')
  })

  it('reports missing ForgeDesk workspaces clearly', async () => {
    const repo = tempDir()
    dirs.push(repo)

    await expect(findRepoWithForgeDesk(repo)).rejects.toThrow(
      'Could not find a ForgeDesk project. Run "forgedesk init --repo ." from a git repository first.'
    )
  })
})
