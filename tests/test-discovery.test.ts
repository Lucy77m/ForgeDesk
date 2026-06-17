import { mkdirSync, writeFileSync } from 'node:fs'
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

  describe('workspace discovery', () => {
    function setupWorkspace(repo: string): void {
      expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
      writeFileSync(
        path.join(repo, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n',
        'utf8'
      )
      writeFileSync(
        path.join(repo, 'package.json'),
        JSON.stringify({
          packageManager: 'pnpm@11.1.3',
          scripts: { test: 'vitest run' }
        }, null, 2),
        'utf8'
      )

      const coreDir = path.join(repo, 'packages', 'core')
      mkdirSync(coreDir, { recursive: true })
      writeFileSync(
        path.join(coreDir, 'package.json'),
        JSON.stringify({
          name: '@test/core',
          scripts: { test: 'vitest run', typecheck: 'tsc --noEmit' }
        }, null, 2),
        'utf8'
      )

      const webDir = path.join(repo, 'packages', 'web')
      mkdirSync(webDir, { recursive: true })
      writeFileSync(
        path.join(webDir, 'package.json'),
        JSON.stringify({
          name: '@test/web',
          scripts: { test: 'vitest run' }
        }, null, 2),
        'utf8'
      )
    }

    it('discovers workspace packages with test scripts', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      setupWorkspace(repo)

      const report = await discoverTestScripts(repo)

      expect(report.isWorkspace).toBe(true)
      expect(report.workspacePackages).toHaveLength(2)
      expect(report.workspacePackages.map((p) => p.name).sort()).toEqual(['@test/core', '@test/web'])
      expect(report.workspacePackages.find((p) => p.name === '@test/core')!.scripts).toHaveLength(2)
      expect(report.workspacePackages.find((p) => p.name === '@test/web')!.scripts).toHaveLength(1)
    })

    it('includes root scripts alongside workspace scripts', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      setupWorkspace(repo)

      const report = await discoverTestScripts(repo)

      const rootScripts = report.scripts.filter((s) => !s.package)
      const packageScripts = report.scripts.filter((s) => s.package)
      expect(rootScripts).toHaveLength(1)
      expect(rootScripts[0].name).toBe('test')
      expect(packageScripts).toHaveLength(3)
    })

    it('uses --filter syntax for workspace package commands', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      setupWorkspace(repo)

      const report = await discoverTestScripts(repo)

      const coreTest = report.workspacePackages
        .find((p) => p.name === '@test/core')!
        .scripts.find((s) => s.name === 'test')!
      expect(coreTest.forgedeskCommand).toBe('forgedesk test -- pnpm --filter @test/core run test')
    })

    it('reports isWorkspace=false when no pnpm-workspace.yaml exists', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
      writeFileSync(
        path.join(repo, 'package.json'),
        '{"scripts":{"test":"node --test"}}\n',
        'utf8'
      )

      const report = await discoverTestScripts(repo)

      expect(report.isWorkspace).toBe(false)
      expect(report.workspacePackages).toEqual([])
    })

    it('falls back to single-package mode when pnpm-workspace.yaml has no packages', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
      writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), 'allowBuilds:\n  esbuild: true\n', 'utf8')
      writeFileSync(
        path.join(repo, 'package.json'),
        '{"scripts":{"test":"node --test"}}\n',
        'utf8'
      )

      const report = await discoverTestScripts(repo)

      expect(report.isWorkspace).toBe(false)
      expect(report.workspacePackages).toEqual([])
    })

    it('uses directory name when workspace package has no name field', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
      writeFileSync(
        path.join(repo, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n',
        'utf8'
      )
      writeFileSync(path.join(repo, 'package.json'), '{}\n', 'utf8')

      const anonDir = path.join(repo, 'packages', 'anon-lib')
      mkdirSync(anonDir, { recursive: true })
      writeFileSync(
        path.join(anonDir, 'package.json'),
        '{"scripts":{"test":"node --test"}}\n',
        'utf8'
      )

      const report = await discoverTestScripts(repo)

      expect(report.isWorkspace).toBe(true)
      expect(report.workspacePackages[0].name).toBe('anon-lib')
    })

    it('skips workspace directories without package.json', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)
      writeFileSync(
        path.join(repo, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n',
        'utf8'
      )
      writeFileSync(path.join(repo, 'package.json'), '{}\n', 'utf8')

      mkdirSync(path.join(repo, 'packages', 'empty'), { recursive: true })

      const report = await discoverTestScripts(repo)

      expect(report.isWorkspace).toBe(false)
      expect(report.workspacePackages).toEqual([])
    })

    it('renders workspace discovery report with package sections', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      setupWorkspace(repo)

      const report = await discoverTestScripts(repo)
      const text = renderTestDiscoveryReport(report)

      expect(text).toContain('Workspace: yes (2 package(s))')
      expect(text).toContain('## Root Scripts')
      expect(text).toContain('## Package: @test/core (packages/core)')
      expect(text).toContain('## Package: @test/web (packages/web)')
      expect(text).toContain('--filter @test/core run test')
    })
  })
})
