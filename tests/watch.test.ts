import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getWatchReport } from '../src/core/watch.js'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

function sessionIds(repo: string): string[] {
  const sessionsDir = path.join(repo, '.forgedesk', 'sessions')
  if (!existsSync(sessionsDir)) {
    return []
  }
  return readdirSync(sessionsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'))
}

describe('watch mode', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('stays idle in manual mode', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Watch manual change\n', 'utf8')

    const result = runCli(repo, ['watch', '--once', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-watch-v1')
    expect(report.autoMode).toBe('manual')
    expect(report.status).toBe('idle')
    expect(report.wroteFiles).toBe(false)
    expect(sessionIds(repo)).toEqual([])
  })

  it('prints compact output in quiet mode', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Watch quiet change\n', 'utf8')

    const result = runCli(repo, ['watch', '--once', '--quiet'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ForgeDesk watch: idle mode=manual wrote=no')
    expect(result.stdout).not.toContain('## Blockers')
  })

  it('suggests the next step in assist mode without writing files', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'assist']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Watch assist change\n', 'utf8')

    const result = runCli(repo, ['watch', '--once', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.autoMode).toBe('assist')
    expect(report.status).toBe('suggested')
    expect(report.wroteFiles).toBe(false)
    expect(report.nextReport.action).toBe('auto-capture')
    expect(sessionIds(repo)).toEqual([])
  })

  it('runs one safe local-auto step', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'local-auto']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Watch local-auto change\n', 'utf8')

    const result = runCli(repo, ['watch', '--once', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.autoMode).toBe('local-auto')
    expect(report.status).toBe('ran')
    expect(report.wroteFiles).toBe(true)
    expect(report.nextReport.action).toBe('auto-capture')
    const ids = sessionIds(repo)
    expect(ids).toHaveLength(1)
    expect(existsSync(path.join(repo, '.forgedesk', 'evidence', ids[0]!, 'evidence.json'))).toBe(true)
  })

  it('blocks in guarded mode without writing files when evidence is missing', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'guarded']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Watch guarded change\n', 'utf8')

    const result = runCli(repo, ['watch', '--once', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.autoMode).toBe('guarded')
    expect(report.status).toBe('blocked')
    expect(report.wroteFiles).toBe(false)
    expect(report.blockers[0]).toContain('Next action is auto-capture')
    expect(sessionIds(repo)).toEqual([])
  })

  it('rejects invalid intervals', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const result = runCli(repo, ['watch', '--once', '--interval', '100'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Watch interval must be at least 500 milliseconds')
  })

  it('getWatchReport throws when no ForgeDesk project exists', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    await expect(getWatchReport(repo)).rejects.toThrow('Could not find a ForgeDesk project')
  })

  it('getWatchReport returns idle when no active session exists', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'assist']).status).toBe(0)

    const report = await getWatchReport(repo)

    expect(report.status).toBe('idle')
    expect(report.autoMode).toBe('assist')
    expect(report.summary).toContain('no active local evidence work')
  })

  it('getWatchReport suggests in assist mode when dirty changes exist', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'assist']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Watch suggest\n', 'utf8')

    const report = await getWatchReport(repo)

    expect(report.status).toBe('suggested')
    expect(report.autoMode).toBe('assist')
    expect(report.wroteFiles).toBe(false)
    expect(report.nextReport).toBeDefined()
    expect(report.nextReport!.action).toBe('auto-capture')
  })

  it('getWatchReport blocks in guarded mode when evidence is not ready', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['auto-config', 'set', 'guarded']).status).toBe(0)
    writeFileSync(path.join(repo, 'README.md'), '# Watch guarded\n', 'utf8')

    const report = await getWatchReport(repo)

    expect(report.status).toBe('blocked')
    expect(report.autoMode).toBe('guarded')
    expect(report.wroteFiles).toBe(false)
  })
})
