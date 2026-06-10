import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readChangeSession,
  readConfig,
  readProject,
  validateConfig,
  validateProject,
  validateSession
} from '../src/core/metadata.js'
import {
  CONFIG_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  SESSION_SCHEMA_VERSION,
  type ChangeSession,
  type Config,
  type Project
} from '../src/types.js'
import { cleanupDir, tempDir } from './helpers.js'

const now = '2026-06-11T00:00:00.000Z'

function project(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: 'demo',
    repoPath: '/tmp/demo',
    goal: 'Record review evidence.',
    defaultBranch: 'main',
    createdAt: now,
    updatedAt: now
  }
}

function config(): Config {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    activeSessionId: 'session-1',
    createdAt: now,
    updatedAt: now
  }
}

function session(): ChangeSession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: 'session-1',
    title: 'Demo change',
    status: 'active',
    intent: 'Exercise metadata validation.',
    decisions: [],
    risks: [],
    tests: [],
    evidenceDir: '.forgedesk/evidence/session-1',
    createdAt: now,
    updatedAt: now
  }
}

describe('metadata validation', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('accepts valid project, config, and session metadata', () => {
    expect(validateProject(project())).toBeUndefined()
    expect(validateConfig(config())).toBeUndefined()
    expect(validateSession(session())).toBeUndefined()
  })

  it('reports schema version errors', () => {
    expect(validateProject({ ...project(), schemaVersion: 'forgedesk-project-v0' })).toBe(
      'schemaVersion must be forgedesk-project-v1'
    )
    expect(validateConfig({ ...config(), schemaVersion: 'forgedesk-config-v0' })).toBe(
      'schemaVersion must be forgedesk-config-v1'
    )
    expect(validateSession({ ...session(), schemaVersion: 'forgedesk-session-v0' })).toBe(
      'schemaVersion must be forgedesk-session-v1'
    )
  })

  it('reports missing required fields', () => {
    const invalidProject = { ...project() } as Record<string, unknown>
    delete invalidProject.name
    const invalidConfig = { ...config() } as Record<string, unknown>
    delete invalidConfig.createdAt
    const invalidSession = { ...session() } as Record<string, unknown>
    delete invalidSession.tests

    expect(validateProject(invalidProject)).toBe('name must be a non-empty string')
    expect(validateConfig(invalidConfig)).toBe('createdAt must be a non-empty string')
    expect(validateSession(invalidSession)).toBe('tests must be an array')
  })

  it('reports optional field type errors', () => {
    expect(validateProject({ ...project(), goal: 123 })).toBe('goal must be a string')
    expect(validateConfig({ ...config(), activeSessionId: 123 })).toBe('activeSessionId must be a string')
    expect(validateSession({ ...session(), intent: 123 })).toBe('intent must be a string')
    expect(validateSession({ ...session(), evidenceDir: 123 })).toBe('evidenceDir must be a string')
  })

  it('reports invalid session statuses', () => {
    expect(validateSession({ ...session(), status: 'closed' })).toBe(
      'status must be one of active, needs-review, done, archived'
    )
  })

  it('wraps invalid JSON read errors with metadata context', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const filePath = path.join(dir, 'project.json')
    writeFileSync(filePath, '{ invalid json', 'utf8')

    await expect(readProject(filePath)).rejects.toThrow('Could not read ForgeDesk project metadata')
    await expect(readProject(filePath)).rejects.toThrow('invalid JSON')
  })

  it('wraps non-object JSON read errors with metadata context', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const configPath = path.join(dir, 'config.json')
    const sessionPath = path.join(dir, 'session.json')
    writeFileSync(configPath, '[]\n', 'utf8')
    writeFileSync(sessionPath, '"not an object"\n', 'utf8')

    await expect(readConfig(configPath)).rejects.toThrow('Invalid ForgeDesk config metadata')
    await expect(readConfig(configPath)).rejects.toThrow('JSON must be an object')
    await expect(readChangeSession(sessionPath)).rejects.toThrow('Invalid ForgeDesk session metadata')
    await expect(readChangeSession(sessionPath)).rejects.toThrow('JSON must be an object')
  })
})
