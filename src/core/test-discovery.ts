import { readFile } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import { ForgeDeskError } from './errors.js'
import { loadWorkspace, pathExists } from './workspace.js'

type PackageJson = {
  name?: string
  packageManager?: string
  scripts?: Record<string, string>
}

export type DiscoveredTestScript = {
  name: string
  command: string
  runner: string
  forgedeskCommand: string
  package?: string
}

export type WorkspacePackage = {
  name: string
  path: string
  packageJson: string
  packageManager: string
  scripts: DiscoveredTestScript[]
}

export type TestDiscoveryReport = {
  schemaVersion: 'forgedesk-test-discovery-v1'
  generatedAt: string
  repoPath: string
  packageJson: string
  packageManager: string
  isWorkspace: boolean
  workspacePackages: WorkspacePackage[]
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

function filterCommandFor(manager: string, packageName: string, scriptName: string): string {
  return `${manager} --filter ${packageName} run ${scriptName}`
}

function isLikelyTestScript(name: string): boolean {
  return preferredScriptNames.includes(name as typeof preferredScriptNames[number])
}

function scriptsFromPackage(pkg: PackageJson | undefined, packageManager: string, packageName?: string): DiscoveredTestScript[] {
  return Object.entries(pkg?.scripts ?? {})
    .filter(([name]) => isLikelyTestScript(name))
    .map(([name, command]) => ({
      name,
      command,
      runner: packageManager,
      forgedeskCommand: packageName
        ? `forgedesk test -- ${filterCommandFor(packageManager, packageName, name)}`
        : `forgedesk test -- ${commandFor(packageManager, name)}`,
      package: packageName
    }))
}

// Simple YAML parser for pnpm-workspace.yaml \u2014 extracts `packages:` glob list.
// Does not support complex YAML. Falls back to empty array on unparseable content.
function parseWorkspacePackages(yaml: string): string[] {
  const lines = yaml.split(/\r?\n/)
  const patterns: string[] = []
  let inPackages = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^packages\s*:/.test(trimmed)) {
      inPackages = true
      // Check inline value: packages: ["a", "b"]
      const inline = trimmed.match(/^packages\s*:\s*\[(.+)\]/)
      if (inline) {
        const items = inline[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
        patterns.push(...items.filter(Boolean))
        inPackages = false
      }
      continue
    }

    if (inPackages) {
      if (trimmed.startsWith('-')) {
        const value = trimmed.replace(/^-\s*/, '').replace(/^["']|["']$/g, '').trim()
        if (value) {
          patterns.push(value)
        }
      } else if (trimmed && !trimmed.startsWith('#')) {
        // Non-empty, non-comment, non-list-item line \u2192 end of packages block
        inPackages = false
      }
    }
  }

  return patterns
}

// Simple glob matching: supports `*` at the end of a path segment (e.g., "packages/*", "apps/*")
function matchGlob(basePath: string, pattern: string): string[] {
  const normalized = pattern.replaceAll('\\', '/')
  // Only support trailing * in a single segment: "packages/*", "apps/*"
  const starMatch = normalized.match(/^(.+)\/\*$/)
  if (starMatch) {
    const dir = path.join(basePath, starMatch[1])
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => path.join(starMatch[1], e.name))
    } catch {
      return []
    }
  }
  // Direct directory reference: "packages"
  const direct = path.join(basePath, normalized)
  try {
    const entries = readdirSync(direct, { withFileTypes: true })
    return entries.length > 0 ? [normalized] : []
  } catch {
    return []
  }
}

async function discoverWorkspacePackages(repoPath: string, packageManager: string): Promise<WorkspacePackage[]> {
  const yamlPath = path.join(repoPath, 'pnpm-workspace.yaml')
  if (!(await pathExists(yamlPath))) {
    return []
  }

  let yaml: string
  try {
    yaml = await readFile(yamlPath, 'utf8')
  } catch {
    return []
  }

  const patterns = parseWorkspacePackages(yaml)
  if (patterns.length === 0) {
    return []
  }

  const packages: WorkspacePackage[] = []
  const seen = new Set<string>()

  for (const pattern of patterns) {
    const dirs = matchGlob(repoPath, pattern)
    for (const dir of dirs) {
      const absDir = path.join(repoPath, dir)
      const pkgPath = path.join(absDir, 'package.json')
      const pkg = await readPackageJson(pkgPath)
      if (!pkg) {
        continue
      }
      const name = pkg.name || path.basename(dir)
      if (seen.has(name)) {
        continue
      }
      seen.add(name)
      packages.push({
        name,
        path: dir,
        packageJson: displayPath(pkgPath),
        packageManager,
        scripts: scriptsFromPackage(pkg, packageManager, name)
      })
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name))
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
  const rootScripts = scriptsFromPackage(pkg, packageManager)

  if (pkg && rootScripts.length === 0) {
    warnings.push('No common test, typecheck, build, lint, or check scripts were found.')
  }

  const workspacePackages = await discoverWorkspacePackages(workspace.repoPath, packageManager)
  const isWorkspace = workspacePackages.length > 0

  const allScripts = [
    ...rootScripts,
    ...workspacePackages.flatMap((wp) => wp.scripts)
  ]

  return {
    schemaVersion: 'forgedesk-test-discovery-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    packageJson,
    packageManager,
    isWorkspace,
    workspacePackages,
    scripts: allScripts,
    warnings
  }
}

export function renderTestDiscoveryReport(report: TestDiscoveryReport): string {
  const sections: string[] = [
    'ForgeDesk Test Discovery',
    '',
    `Repo: ${displayPath(report.repoPath)}`,
    `Package: ${displayPath(report.packageJson)}`,
    `Package manager: ${report.packageManager}`,
  ]

  if (report.isWorkspace) {
    sections.push(`Workspace: yes (${report.workspacePackages.length} package(s))`)
  }

  sections.push('')
  sections.push('## Root Scripts')
  sections.push(...listLinesOrNone(
    report.scripts
      .filter((s) => !s.package)
      .map((script) => `${script.name}: ${script.forgedeskCommand}`)
  ))

  if (report.isWorkspace) {
    for (const wp of report.workspacePackages) {
      sections.push('')
      sections.push(`## Package: ${wp.name} (${displayPath(wp.path)})`)
      sections.push(...listLinesOrNone(
        wp.scripts.map((script) => `${script.name}: ${script.forgedeskCommand}`)
      ))
    }
  }

  sections.push('')
  sections.push('## Warnings')
  sections.push(...listLinesOrNone(report.warnings))
  sections.push('')
  sections.push('Discovery does not run tests. Use a generated task or run "forgedesk test -- <command>" explicitly.')

  return sections.join('\n')
}
