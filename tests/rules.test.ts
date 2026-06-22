import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getRulesReport } from '../src/core/rules.js'
import { pathsFor } from '../src/core/workspace.js'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

describe('rules presets', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('shows no rules when rules.json does not exist', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const report = await getRulesReport(repo)

    expect(report.action).toBe('show')
    expect(report.ruleCount).toBe(0)
  })

  it('installs security preset', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const result = runCli(repo, ['rules', '--preset', 'security', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.action).toBe('installed')
    expect(report.preset).toBe('security')
    expect(report.ruleCount).toBeGreaterThan(0)

    const rulesPath = path.join(pathsFor(repo).forgedeskDir, 'rules.json')
    expect(existsSync(rulesPath)).toBe(true)
    const rules = JSON.parse(readFileSync(rulesPath, 'utf8'))
    expect(rules.schemaVersion).toBe('forgedesk-rules-v1')
    expect(rules.rules.length).toBeGreaterThan(0)
  })

  it('installs default preset', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const result = runCli(repo, ['rules', '--preset', 'default'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Installed')
  })

  it('refuses to overwrite existing rules.json without --force', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['rules', '--preset', 'security']).status).toBe(0)

    const result = runCli(repo, ['rules', '--preset', 'default'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('rules.json already exists')
  })

  it('overwrites with --force', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['rules', '--preset', 'security']).status).toBe(0)

    const result = runCli(repo, ['rules', '--preset', 'default', '--force'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Installed')
  })

  it('rejects unknown preset names', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const result = runCli(repo, ['rules', '--preset', 'nonexistent'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Unknown preset')
  })

  it('shows rules count after installation', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['rules', '--preset', 'security']).status).toBe(0)

    const result = runCli(repo, ['rules', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.action).toBe('show')
    expect(report.ruleCount).toBeGreaterThan(0)
  })
})
