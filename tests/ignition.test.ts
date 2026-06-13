import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

function tasksPath(repo: string): string {
  return path.join(repo, '.vscode', 'tasks.json')
}

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

describe('ignition', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('installs, reports, and uninstalls the folder-open watch task', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const status = runCli(repo, ['ignition', 'status', '--json'])
    expect(status.status).toBe(0)
    expect(JSON.parse(status.stdout).state).toBe('missing')

    const install = runCli(repo, ['ignition', 'install', '--json'])
    expect(install.status).toBe(0)
    const installReport = JSON.parse(install.stdout)
    expect(installReport.schemaVersion).toBe('forgedesk-ignition-v1')
    expect(installReport.state).toBe('installed')
    expect(installReport.warnings[0]).toContain('allow automatic tasks')

    const tasks = readJson(tasksPath(repo))
    const task = tasks.tasks.find((item: { label: string }) => item.label === 'ForgeDesk: Ignition Watch')
    expect(task.command).toBe('forgedesk')
    expect(task.args).toEqual(['watch', '--quiet'])
    expect(task.runOptions.runOn).toBe('folderOpen')
    expect(task.isBackground).toBe(true)

    const uninstall = runCli(repo, ['ignition', 'uninstall', '--json'])
    expect(uninstall.status).toBe(0)
    expect(JSON.parse(uninstall.stdout).state).toBe('missing')
    expect(readJson(tasksPath(repo)).tasks.some((item: { label: string }) => item.label === 'ForgeDesk: Ignition Watch')).toBe(false)
  })

  it('refuses to overwrite unmanaged ignition task labels', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    mkdirSync(path.dirname(tasksPath(repo)), { recursive: true })
    writeFileSync(
      tasksPath(repo),
      JSON.stringify({
        version: '2.0.0',
        tasks: [{ label: 'ForgeDesk: Ignition Watch', type: 'shell', command: 'echo custom' }]
      }, null, 2),
      'utf8'
    )

    const install = runCli(repo, ['ignition', 'install'])

    expect(install.status).not.toBe(0)
    expect(install.stderr).toContain('Refusing to overwrite unmanaged VS Code task')
    expect(readJson(tasksPath(repo)).tasks[0].command).toBe('echo custom')
  })
})
