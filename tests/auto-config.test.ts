import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  describeAutoMode,
  getAutoConfigReport,
  parseAutoMode,
  readAutoConfig,
  setAutoConfigMode,
  validateAutoConfig
} from '../src/core/auto-config.js'
import { loadWorkspace, pathsFor } from '../src/core/workspace.js'
import { AUTO_CONFIG_SCHEMA_VERSION } from '../src/types.js'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

describe('auto config', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('uses a manual default until an auto config file is written', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const workspace = await loadWorkspace(repo)
    const state = await readAutoConfig(workspace)

    expect(state.source).toBe('default')
    expect(state.config.mode).toBe('manual')
  })

  it('sets and reads an auto profile file', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const report = await setAutoConfigMode(repo, 'assist')

    expect(report.config.mode).toBe('assist')
    expect(report.source).toBe('file')
    expect(report.path).toBe(pathsFor(repo).autoConfigFile)
    const stored = JSON.parse(readFileSync(pathsFor(repo).autoConfigFile, 'utf8'))
    expect(stored.schemaVersion).toBe(AUTO_CONFIG_SCHEMA_VERSION)
    expect(stored.mode).toBe('assist')
  })

  it('validates mode and required metadata', () => {
    expect(validateAutoConfig({
      schemaVersion: AUTO_CONFIG_SCHEMA_VERSION,
      mode: 'local-auto',
      createdAt: '2026-06-13T00:00:00.000Z',
      updatedAt: '2026-06-13T00:00:00.000Z'
    })).toBeUndefined()
    expect(validateAutoConfig({})).toContain('schemaVersion')
    expect(validateAutoConfig({
      schemaVersion: AUTO_CONFIG_SCHEMA_VERSION,
      mode: 'daemon',
      createdAt: '2026-06-13T00:00:00.000Z',
      updatedAt: '2026-06-13T00:00:00.000Z'
    })).toContain('mode must be one of')
    expect(() => parseAutoMode('daemon')).toThrow('Auto mode must be one of')
  })

  it('reports invalid auto config files through the CLI', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    mkdirSync(path.join(repo, '.forgedesk'), { recursive: true })
    writeFileSync(pathsFor(repo).autoConfigFile, '{"schemaVersion":"wrong"}\n', 'utf8')

    const result = runCli(repo, ['auto-config'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Invalid ForgeDesk auto config')
  })

  it('describes all modes as bounded local automation', async () => {
    for (const mode of ['manual', 'assist', 'local-auto', 'guarded'] as const) {
      const details = describeAutoMode(mode)
      expect(details.mode).toBe(mode)
      expect(details.summary.length).toBeGreaterThan(10)
      expect(details.hooks).toContain('hook')
      expect(details.watch).toContain('Watch')
    }

    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    const report = await getAutoConfigReport(repo)
    expect(report.schemaVersion).toBe('forgedesk-auto-config-report-v1')
    expect(report.next[0]).toContain('auto-config set assist')
  })
})
