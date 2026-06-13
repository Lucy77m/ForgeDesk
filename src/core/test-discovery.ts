import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import { ForgeDeskError } from './errors.js'
import { loadWorkspace, pathExists } from './workspace.js'

type PackageJson = {
  packageManager?: string
  scripts?: Record<string, string>
}

export type DiscoveredTestScript = {
  name: string
  command: string
  runner: string
  forgedeskCommand: string
}

export type TestDiscoveryReport = {
  schemaVersion: 'forgedesk-test-discovery-v1'
  generatedAt: string
  repoPath: string
  packageJson: string
  packageManager: string
  scripts: DiscoveredTestScript[]
  warnings: string[]
}

const preferredScriptNames = ['test', 'typecheck', 'build', 'lint', 'check'] as const

async function readPackageJson(filePath: string): Promise<PackageJson | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined
  }
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw.replace(/^\uFEFF/, '')) as PackageJson
  } catch {
    throw new ForgeDeskError(`Could not read package.json at ${displayPath(filePath)} as JSON.`)
  }
}

function packageManagerFor(pkg: PackageJson | undefined): string {
  const manager = pkg?.packageManager?.split('@')[0]?.trim()
  return manager || 'npm'
}

function commandFor(manager: string, name: string): string {
  return manager === 'npm' ? `npm run ${name}` : `${manager} run ${name}`
}

function isLikelyTestScript(name: string): boolean {
  return preferredScriptNames.includes(name as typeof preferredScriptNames[number])
}

export async function discoverTestScripts(cwd: string): Promise<TestDiscoveryReport> {
  const workspace = await loadWorkspace(cwd)
  const packageJson = path.join(workspace.repoPath, 'package.json')
  const pkg = await readPackageJson(packageJson)
  const warnings: string[] = []

  if (!pkg) {
    warnings.push('package.json was not found.')
  }

  const packageManager = packageManagerFor(pkg)
  const scripts = Object.entries(pkg?.scripts ?? {})
    .filter(([name]) => isLikelyTestScript(name))
    .map(([name, command]) => ({
      name,
      command,
      runner: packageManager,
      forgedeskCommand: `forgedesk test -- ${commandFor(packageManager, name)}`
    }))

  if (pkg && scripts.length === 0) {
    warnings.push('No common test, typecheck, build, lint, or check scripts were found.')
  }

  return {
    schemaVersion: 'forgedesk-test-discovery-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    packageJson,
    packageManager,
    scripts,
    warnings
  }
}

export function renderTestDiscoveryReport(report: TestDiscoveryReport): string {
  return [
    'ForgeDesk Test Discovery',
    '',
    `Repo: ${displayPath(report.repoPath)}`,
    `Package: ${displayPath(report.packageJson)}`,
    `Package manager: ${report.packageManager}`,
    '',
    '## Scripts',
    ...listLinesOrNone(report.scripts.map((script) => `${script.name}: ${script.forgedeskCommand}`)),
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings),
    '',
    'Discovery does not run tests. Use a generated task or run "forgedesk test -- <command>" explicitly.'
  ].join('\n')
}
