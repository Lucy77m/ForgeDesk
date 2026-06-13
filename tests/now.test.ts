import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

function nowPath(repo: string): string {
  return path.join(repo, '.forgedesk', 'NOW.md')
}

function activeSessionId(repo: string): string {
  return JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
}

describe('NOW.md', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('refreshes and prints the current local state', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'assist']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'NOW status']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Exercise NOW status.']).status).toBe(0)

    const result = runCli(repo, ['now', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-now-v1')
    expect(report.autoMode).toBe('assist')
    expect(report.session.title).toBe('NOW status')
    expect(report.blockers).toContain('Active session has no generated evidence.')
    expect(existsSync(nowPath(repo))).toBe(true)
    const markdown = readFileSync(nowPath(repo), 'utf8')
    expect(markdown).toContain('# ForgeDesk NOW')
    expect(markdown).toContain('Session: NOW status')
    expect(markdown).toContain('Auto mode: assist')
  })

  it('updates NOW.md after next generates evidence', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'NOW next']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Refresh NOW after next.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Reviewed NOW after next.']).status).toBe(0)

    const result = runCli(repo, ['next'])

    expect(result.status).toBe(0)
    const markdown = readFileSync(nowPath(repo), 'utf8')
    expect(markdown).toContain('Session: NOW next')
    expect(markdown).toContain('Ready: yes')
    expect(markdown).toContain(`Session ID: ${activeSessionId(repo)}`)
    expect(markdown).toContain('Review context:')
    expect(markdown).toContain('PR body:')
  })

  it('updates NOW.md after watch --once', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'assist']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# NOW watch\n', 'utf8')

    const result = runCli(repo, ['watch', '--once'])

    expect(result.status).toBe(0)
    const markdown = readFileSync(nowPath(repo), 'utf8')
    expect(markdown).toContain('# ForgeDesk NOW')
    expect(markdown).toContain('Auto mode: assist')
    expect(markdown).toContain('Session: None')
  })
})
