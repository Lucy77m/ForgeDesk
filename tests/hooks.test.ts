import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

function hookFile(repo: string, name: string): string {
  return path.join(repo, '.git', 'hooks', name)
}

function sessionIds(repo: string): string[] {
  const sessionsDir = path.join(repo, '.forgedesk', 'sessions')
  if (!existsSync(sessionsDir)) {
    return []
  }
  return readdirSync(sessionsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'))
}

describe('git hooks', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('installs, reports, and uninstalls ForgeDesk-managed hooks', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'assist']).status).toBe(0)

    const before = runCli(repo, ['hooks', 'status', '--json'])
    expect(before.status).toBe(0)
    expect(JSON.parse(before.stdout).hooks.every((hook: { state: string }) => hook.state === 'missing')).toBe(true)

    const install = runCli(repo, ['hooks', 'install', '--json'])
    expect(install.status).toBe(0)
    const installReport = JSON.parse(install.stdout)
    expect(installReport.schemaVersion).toBe('forgedesk-hooks-install-v1')
    expect(installReport.autoMode).toBe('assist')
    expect(installReport.hooks.map((hook: { name: string; state: string }) => [hook.name, hook.state])).toEqual([
      ['pre-commit', 'installed'],
      ['pre-push', 'installed']
    ])
    expect(readFileSync(hookFile(repo, 'pre-commit'), 'utf8')).toContain('forgedesk-hook: managed')
    expect(readFileSync(hookFile(repo, 'pre-push'), 'utf8')).toContain('hooks run pre-push')

    const after = runCli(repo, ['hooks', 'status'])
    expect(after.status).toBe(0)
    expect(after.stdout).toContain('pre-commit: installed')
    expect(after.stdout).toContain('pre-push: installed')

    const uninstall = runCli(repo, ['hooks', 'uninstall', '--json'])
    expect(uninstall.status).toBe(0)
    const uninstallReport = JSON.parse(uninstall.stdout)
    expect(uninstallReport.hooks.every((hook: { operation: string }) => hook.operation === 'removed')).toBe(true)
    expect(existsSync(hookFile(repo, 'pre-commit'))).toBe(false)
    expect(existsSync(hookFile(repo, 'pre-push'))).toBe(false)
  })

  it('refuses to overwrite unmanaged git hooks', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(hookFile(repo, 'pre-commit'), '#!/bin/sh\necho custom\n', 'utf8')

    const install = runCli(repo, ['hooks', 'install'])

    expect(install.status).not.toBe(0)
    expect(install.stderr).toContain('Refusing to overwrite unmanaged git hook')
    expect(readFileSync(hookFile(repo, 'pre-commit'), 'utf8')).toContain('echo custom')
    expect(existsSync(hookFile(repo, 'pre-push'))).toBe(false)
  })

  it('warns but passes hook runs in assist mode', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'assist']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Hook assist change\n', 'utf8')

    const result = runCli(repo, ['hooks', 'run', 'pre-commit', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-hook-run-v1')
    expect(report.autoMode).toBe('assist')
    expect(report.outcome).toBe('passed')
    expect(report.nextReport.action).toBe('auto-capture')
    expect(sessionIds(repo)).toEqual([])
  })

  it('blocks hook runs in guarded mode when evidence is not ready', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'guarded']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Hook guarded change\n', 'utf8')

    const result = runCli(repo, ['hooks', 'run', 'pre-commit', '--json'])

    expect(result.status).not.toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.autoMode).toBe('guarded')
    expect(report.outcome).toBe('blocked')
    expect(report.blockers[0]).toContain('Next action is auto-capture')
  })

  it('runs one safe next step in local-auto mode', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'local-auto']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Hook local-auto change\n', 'utf8')

    const result = runCli(repo, ['hooks', 'run', 'pre-commit', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.autoMode).toBe('local-auto')
    expect(report.outcome).toBe('passed')
    expect(report.nextReport.action).toBe('auto-capture')
    const ids = sessionIds(repo)
    expect(ids).toHaveLength(1)
    expect(existsSync(path.join(repo, '.forgedesk', 'evidence', ids[0]!, 'evidence.json'))).toBe(true)
  })

  it('rejects unknown hook names', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const result = runCli(repo, ['hooks', 'run', 'post-merge'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Hook must be one of')
  })
})
