import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

function tasksPath(repo: string): string {
  return path.join(repo, '.vscode', 'tasks.json')
}

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

describe('shortcuts', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('installs, reports, and uninstalls VS Code tasks', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const status = runCli(repo, ['shortcuts', 'status', '--json'])
    expect(status.status).toBe(0)
    expect(JSON.parse(status.stdout).vscode.state).toBe('missing')

    const install = runCli(repo, ['shortcuts', 'install', '--json'])
    expect(install.status).toBe(0)
    const installReport = JSON.parse(install.stdout)
    expect(installReport.schemaVersion).toBe('forgedesk-shortcuts-v1')
    expect(installReport.vscode.state).toBe('installed')
    expect(installReport.packageScripts.state).toBe('skipped')

    const tasks = readJson(tasksPath(repo))
    expect(tasks.version).toBe('2.0.0')
    expect(tasks.tasks.map((task: { label: string }) => task.label)).toContain('ForgeDesk: Next')
    expect(tasks.tasks.find((task: { label: string }) => task.label === 'ForgeDesk: Watch').command).toBe('forgedesk')

    const uninstall = runCli(repo, ['shortcuts', 'uninstall', '--json'])
    expect(uninstall.status).toBe(0)
    const uninstallReport = JSON.parse(uninstall.stdout)
    expect(uninstallReport.vscode.state).toBe('missing')
    expect(readJson(tasksPath(repo)).tasks).toEqual([])
  })

  it('refuses to overwrite unmanaged VS Code task labels', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    mkdirSync(path.dirname(tasksPath(repo)), { recursive: true })
    writeFileSync(
      tasksPath(repo),
      JSON.stringify({
        version: '2.0.0',
        tasks: [{ label: 'ForgeDesk: Next', type: 'shell', command: 'echo custom' }]
      }, null, 2),
      'utf8'
    )

    const install = runCli(repo, ['shortcuts', 'install'])

    expect(install.status).not.toBe(0)
    expect(install.stderr).toContain('Refusing to overwrite unmanaged VS Code task')
    expect(readJson(tasksPath(repo)).tasks[0].command).toBe('echo custom')
  })

  it('optionally installs and removes package scripts', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, 'package.json'), '{"private":true,"scripts":{"test":"node --version"}}\n', 'utf8')

    const install = runCli(repo, ['shortcuts', 'install', '--package-scripts', '--json'])

    expect(install.status).toBe(0)
    const pkg = readJson(path.join(repo, 'package.json'))
    expect(pkg.scripts.test).toBe('node --version')
    expect(pkg.scripts['forgedesk:next']).toBe('forgedesk next')
    expect(pkg.scripts['forgedesk:watch']).toBe('forgedesk watch')
    expect(JSON.parse(install.stdout).packageScripts.state).toBe('installed')

    const uninstall = runCli(repo, ['shortcuts', 'uninstall', '--package-scripts', '--json'])
    expect(uninstall.status).toBe(0)
    const updated = readJson(path.join(repo, 'package.json'))
    expect(updated.scripts.test).toBe('node --version')
    expect(updated.scripts['forgedesk:next']).toBeUndefined()
    expect(JSON.parse(uninstall.stdout).packageScripts.state).toBe('missing')
  })

  it('skips package scripts when package.json is absent', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const install = runCli(repo, ['shortcuts', 'install', '--package-scripts', '--json'])

    expect(install.status).toBe(0)
    const report = JSON.parse(install.stdout)
    expect(report.packageScripts.state).toBe('missing')
    expect(report.warnings[0]).toContain('package.json was not found')
    expect(existsSync(tasksPath(repo))).toBe(true)
  })

  it('reads package.json files with a UTF-8 BOM', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, 'package.json'), '\uFEFF{"private":true,"scripts":{}}\n', 'utf8')

    const install = runCli(repo, ['shortcuts', 'install', '--package-scripts', '--json'])

    expect(install.status).toBe(0)
    expect(JSON.parse(install.stdout).packageScripts.state).toBe('installed')
    expect(readJson(path.join(repo, 'package.json')).scripts['forgedesk:next']).toBe('forgedesk next')
  })

  it('refuses to overwrite unmanaged package scripts', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, 'package.json'), '{"scripts":{"forgedesk:next":"echo custom"}}\n', 'utf8')

    const install = runCli(repo, ['shortcuts', 'install', '--package-scripts'])

    expect(install.status).not.toBe(0)
    expect(install.stderr).toContain('Refusing to overwrite unmanaged package script')
    expect(readJson(path.join(repo, 'package.json')).scripts['forgedesk:next']).toBe('echo custom')
  })
})
