import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openLocalTarget, parseOpenTarget, type OpenRunner } from '../src/core/open.js'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

describe('open helper', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  function captureRunner(calls: Array<{ command: string; args: string[] }>): OpenRunner {
    return (command, args) => {
      calls.push({ command, args })
      return { status: 0 }
    }
  }

  it('opens NOW.md with an injected runner', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['setup']).status).toBe(0)
    const calls: Array<{ command: string; args: string[] }> = []

    const report = await openLocalTarget(repo, 'now', captureRunner(calls))

    expect(report.target).toBe('now')
    expect(report.path).toContain('.forgedesk/NOW.md')
    expect(existsSync(path.join(repo, '.forgedesk', 'NOW.md'))).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].args.join(' ')).toContain(path.join(repo, '.forgedesk', 'NOW.md'))
  })

  it('opens generated evidence files and exported evidence directories', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    writeFileSync(path.join(repo, 'README.md'), '# Demo changed\n', 'utf8')

    expect(runCli(repo, ['next']).status).toBe(0)
    expect(runCli(repo, ['test', '--command', 'npm test']).status).toBe(0)
    expect(runCli(repo, ['next']).status).toBe(0)
    expect(runCli(repo, ['next']).status).toBe(0)

    const config = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8'))
    const sessionId = config.activeSessionId
    const calls: Array<{ command: string; args: string[] }> = []
    const runner = captureRunner(calls)

    const evidence = await openLocalTarget(repo, 'evidence', runner)
    const reviewContext = await openLocalTarget(repo, 'review-context', runner)
    const pr = await openLocalTarget(repo, 'pr', runner)
    const exported = await openLocalTarget(repo, 'export', runner)

    expect(evidence.path).toContain(`.forgedesk/evidence/${sessionId}`)
    expect(reviewContext.path).toContain('REVIEW_CONTEXT.md')
    expect(pr.path).toContain('PR_BODY.md')
    expect(exported.path).toContain(`.forgedesk/exports/${sessionId}`)
    expect(calls).toHaveLength(4)
  })

  it('fails clearly when the target does not exist', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    expect(runCli(repo, ['start', '--title', 'Missing export']).status).toBe(0)
    expect(runCli(repo, ['intent', 'Prepare evidence without export.']).status).toBe(0)
    expect(runCli(repo, ['check', 'Manual check recorded.']).status).toBe(0)
    expect(runCli(repo, ['evidence']).status).toBe(0)

    await expect(openLocalTarget(repo, 'export', captureRunner([]))).rejects.toThrow('target does not exist')
  })

  it('validates target names', () => {
    expect(parseOpenTarget(undefined)).toBe('now')
    expect(parseOpenTarget('pr')).toBe('pr')
    expect(() => parseOpenTarget('missing')).toThrow('Open target must be one of')
  })
})
