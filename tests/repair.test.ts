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

describe('repair', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('refreshes NOW and installs safe editor shortcuts by default', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const result = runCli(repo, ['repair', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-repair-v1')
    expect(report.repaired).toContain('now')
    expect(report.repaired).toContain('shortcuts')
    expect(existsSync(path.join(repo, '.forgedesk', 'NOW.md'))).toBe(true)
    const tasks = readJson(tasksPath(repo))
    expect(tasks.tasks.map((task: { label: string }) => task.label)).toContain('ForgeDesk: Next')
    expect(tasks.tasks.map((task: { label: string }) => task.label)).not.toContain('ForgeDesk: Ignition Watch')
    expect(existsSync(path.join(repo, '.git', 'hooks', 'pre-commit'))).toBe(false)
  })

  it('can repair optional test tasks explicitly', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, 'package.json'), '{"scripts":{"test":"node --version"}}\n', 'utf8')

    const result = runCli(repo, ['repair', '--test-tasks', '--json'])

    expect(result.status).toBe(0)
    const tasks = readJson(tasksPath(repo))
    const testTask = tasks.tasks.find((task: { label: string }) => task.label === 'ForgeDesk Test: test')
    expect(testTask.args).toEqual(['test', '--', 'npm', 'run', 'test'])
  })

  it('does not overwrite unmanaged editor tasks', () => {
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

    const result = runCli(repo, ['repair', '--json'])

    expect(result.status).not.toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.blockers[0]).toContain('Refusing to overwrite unmanaged VS Code task')
    expect(readJson(tasksPath(repo)).tasks[0].command).toBe('echo custom')
  })
})
