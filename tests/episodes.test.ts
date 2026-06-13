import { appendFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

describe('episodes', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('reports no active episode without creating one', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const result = runCli(repo, ['episodes', 'status', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-episode-status-v1')
    expect(report.phase).toBe('no-active-session')
    expect(report.next[0]).toContain('forgedesk next')
  })

  it('moves from needs-evidence to ready and exported phases', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Episode flow']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Capture the episode state.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Manual verification recorded.']).status).toBe(0)

    const beforeEvidence = runCli(repo, ['episodes', 'status', '--json'])
    expect(beforeEvidence.status).toBe(0)
    expect(JSON.parse(beforeEvidence.stdout).phase).toBe('needs-evidence')

    expect(runCli(repo, ['evidence']).status).toBe(0)
    const ready = runCli(repo, ['episodes', 'status', '--json'])
    expect(ready.status).toBe(0)
    expect(JSON.parse(ready.stdout).phase).toBe('ready')

    expect(runCli(repo, ['export']).status).toBe(0)
    const exported = runCli(repo, ['episodes', 'status', '--json'])
    expect(exported.status).toBe(0)
    expect(JSON.parse(exported.stdout).phase).toBe('exported')
  })

  it('reports stale evidence when the local diff changes', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Stale episode']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Capture stale evidence.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Manual verification recorded.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    appendFileSync(path.join(repo, 'README.md'), '\nnew local change\n', 'utf8')
    const result = runCli(repo, ['episodes', 'status', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.phase).toBe('stale-evidence')
    expect(report.evidenceFresh).toBe(false)
  })
})
