import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverTestScripts, renderTestDiscoveryReport } from '../src/core/test-discovery.js'
import { cleanupDir, initGitRepo, runCli, tempDir } from './helpers.js'

describe('test discovery', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('discovers common package scripts without running them', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(
      path.join(repo, 'package.json'),
      JSON.stringify({
        packageManager: 'pnpm@11.1.3',
        scripts: {
          test: 'vitest run',
          typecheck: 'tsc --noEmit',
          build: 'tsc -p tsconfig.build.json',
          dev: 'tsx src/index.ts'
        }
      }, null, 2),
      'utf8'
    )

    const report = await discoverTestScripts(repo)

    expect(report.schemaVersion).toBe('forgedesk-test-discovery-v1')
    expect(report.packageManager).toBe('pnpm')
    expect(report.scripts.map((script) => script.name)).toEqual(['test', 'typecheck', 'build'])
    expect(report.scripts[0]).toMatchObject({
      name: 'test',
      command: 'vitest run',
      runner: 'pnpm',
      forgedeskCommand: 'forgedesk test -- pnpm run test'
    })
    expect(renderTestDiscoveryReport(report)).toContain('test: forgedesk test -- pnpm run test')
  })

  it('reports missing package.json as a warning', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

    const report = await discoverTestScripts(repo)

    expect(report.scripts).toEqual([])
    expect(report.warnings[0]).toContain('package.json was not found')
  })

  it('exposes discovery through the CLI', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
    writeFileSync(path.join(repo, 'package.json'), '{"scripts":{"test":"node --test"}}\n', 'utf8')

    const result = runCli(repo, ['tests', 'discover', '--json'])

    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.schemaVersion).toBe('forgedesk-test-discovery-v1')
    expect(report.scripts[0].forgedeskCommand).toBe('forgedesk test -- npm run test')
  })
})
