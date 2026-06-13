import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

function activeSessionId(repo: string): string {
  return JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
}

function createReadyEvidence(repo: string): string {
  expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
  expect(runCli(repo, ['start', '--title', 'CI evidence gate']).status).toBe(0)
  expect(runCli(repo, ['intent', 'Verify the CI evidence gate.']).status).toBe(0)
  expect(runCli(repo, ['check', 'Reviewed CI evidence gate output.']).status).toBe(0)
  expect(runCli(repo, ['evidence']).status).toBe(0)
  return activeSessionId(repo)
}

describe('ci evidence gate', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('passes for ready evidence', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    const sessionId = createReadyEvidence(repo)

    const result = runCli(repo, ['ci', 'check', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-ci-check-v1')
    expect(report.status).toBe('pass')
    expect(report.ready).toBe(true)
    expect(report.inspectOk).toBe(true)
    expect(report.freshness).toBe('skipped-clean-worktree')
    expect(report.session.id).toBe(sessionId)
  })

  it('fails when evidence has not been generated', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Missing CI evidence']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Exercise missing CI evidence.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Recorded verification but not evidence.']).status).toBe(0)

    const result = runCli(repo, ['ci', 'check', '--json'])

    expect(result.status).not.toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.status).toBe('fail')
    expect(report.inspectOk).toBe(false)
    expect(report.freshness).toBe('missing')
    expect(report.blockers.join('\n')).toContain('no generated evidence')
  })

  it('fails when evidence is stale for a dirty local diff', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createReadyEvidence(repo)
    writeFileSync(path.join(repo, 'README.md'), '# CI evidence gate changed\n', 'utf8')

    const result = runCli(repo, ['ci', 'check', '--json'])

    expect(result.status).not.toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.status).toBe('fail')
    expect(report.freshness).toBe('stale')
    expect(report.blockers.join('\n')).toContain('Evidence is stale')
  })

  it('prints a GitHub Actions evidence gate workflow', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    const result = runCli(repo, ['ci', 'print'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('name: ForgeDesk Evidence Gate')
    expect(result.stdout).toContain('forgedesk ci check')
    expect(result.stdout).not.toContain('secrets.')
  })

  it('writes and protects the CI workflow file', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const init = runCli(repo, ['ci', 'init', '--json'])
    expect(init.status).toBe(0)
    const report = JSON.parse(init.stdout)
    expect(report.schemaVersion).toBe('forgedesk-ci-init-v1')
    expect(report.wrote).toBe(true)
    expect(existsSync(path.join(repo, '.github', 'workflows', 'forgedesk-evidence.yml'))).toBe(true)

    const second = runCli(repo, ['ci', 'init'])
    expect(second.status).not.toBe(0)
    expect(second.stderr).toContain('CI workflow already exists')

    const forced = runCli(repo, ['ci', 'init', '--force'])
    expect(forced.status).toBe(0)
    expect(readFileSync(path.join(repo, '.github', 'workflows', 'forgedesk-evidence.yml'), 'utf8')).toContain(
      'forgedesk ci check'
    )
  })
})
