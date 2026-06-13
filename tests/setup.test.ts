import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

describe('setup', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('initializes ForgeDesk and repairs safe local entry points by default', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'package.json'), '{"scripts":{"test":"node --version"}}\n', 'utf8')

    const result = runCli(repo, ['setup', '--test-tasks', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-setup-v1')
    expect(report.initialized).toBe(true)
    expect(report.autoMode).toBe('assist')
    expect(report.repair.repaired).toContain('now')
    expect(report.repair.repaired).toContain('shortcuts')
    expect(existsSync(path.join(repo, '.forgedesk', 'project.json'))).toBe(true)
    expect(existsSync(path.join(repo, '.forgedesk', 'NOW.md'))).toBe(true)
    const tasks = readJson(path.join(repo, '.vscode', 'tasks.json'))
    expect(tasks.tasks.map((task: { label: string }) => task.label)).toContain('ForgeDesk: Next')
    expect(tasks.tasks.map((task: { label: string }) => task.label)).toContain('ForgeDesk Test: test')
    expect(tasks.tasks.map((task: { label: string }) => task.label)).not.toContain('ForgeDesk: Ignition Watch')
    expect(existsSync(path.join(repo, '.git', 'hooks', 'pre-commit'))).toBe(false)
  })

  it('can explicitly install ignition and hooks', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    const result = runCli(repo, ['setup', '--mode', 'local-auto', '--ignition', '--hooks', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.autoMode).toBe('local-auto')
    expect(report.ignition.state).toBe('installed')
    expect(report.hooks.hooks.map((hook: { name: string; state: string }) => `${hook.name}:${hook.state}`)).toEqual([
      'pre-commit:installed',
      'pre-push:installed'
    ])
    const auto = readJson(path.join(repo, '.forgedesk', 'auto.json'))
    expect(auto.mode).toBe('local-auto')
    const tasks = readJson(path.join(repo, '.vscode', 'tasks.json'))
    const ignition = tasks.tasks.find((task: { label: string }) => task.label === 'ForgeDesk: Ignition Watch')
    expect(ignition.args).toEqual(['watch', '--quiet'])
    expect(existsSync(path.join(repo, '.git', 'hooks', 'pre-commit'))).toBe(true)
  })
})
