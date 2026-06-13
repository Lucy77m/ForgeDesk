import { displayPath, listLinesOrNone } from '../templates/format.js'
import type { AutoMode } from '../types.js'
import { installHooks, type HooksInstallReport } from './hooks.js'
import { installIgnition, type IgnitionReport } from './ignition.js'
import { initProject } from './session.js'
import { repairLocalSetup, type RepairOptions, type RepairReport } from './repair.js'
import { setAutoConfigMode } from './auto-config.js'
import { isForgeDeskError } from './errors.js'
import { loadWorkspace, type Workspace } from './workspace.js'

export type SetupOptions = RepairOptions & {
  mode?: AutoMode
  ignition?: boolean
  hooks?: boolean
  cliPath: string
}

export type SetupReport = {
  schemaVersion: 'forgedesk-setup-v1'
  generatedAt: string
  repoPath: string
  initialized: boolean
  autoMode: AutoMode
  repair: RepairReport
  ignition?: IgnitionReport
  hooks?: HooksInstallReport
  warnings: string[]
  next: string[]
}

async function ensureProject(cwd: string): Promise<{ workspace: Workspace; initialized: boolean }> {
  try {
    return { workspace: await loadWorkspace(cwd), initialized: false }
  } catch (error) {
    if (!isForgeDeskError(error, 'PROJECT_NOT_FOUND')) {
      throw error
    }
    await initProject('.', cwd)
    return { workspace: await loadWorkspace(cwd), initialized: true }
  }
}

export async function runSetup(cwd: string, options: SetupOptions): Promise<SetupReport> {
  const { workspace, initialized } = await ensureProject(cwd)
  const autoMode = options.mode ?? 'assist'
  await setAutoConfigMode(workspace.repoPath, autoMode)
  const repair = await repairLocalSetup(workspace.repoPath, {
    packageScripts: options.packageScripts,
    testTasks: options.testTasks
  })
  const ignition = options.ignition ? await installIgnition(workspace.repoPath) : undefined
  const hooks = options.hooks ? await installHooks(workspace.repoPath, options.cliPath) : undefined

  const warnings = [
    ...repair.warnings,
    ...(ignition?.warnings ?? []),
    ...(hooks?.warnings ?? [])
  ]
  const next = [
    'Run "forgedesk next --dry-run" to preview the next local action.',
    'Run "forgedesk next" to continue.',
    options.ignition ? 'Reopen the folder if you want to verify ignition.' : 'Run "forgedesk ignition install" later if you want folder-open watch.',
    options.hooks ? 'Git hooks are installed; run "forgedesk hooks status" to inspect them.' : 'Run "forgedesk hooks install" later if you want git hook checks.'
  ]

  return {
    schemaVersion: 'forgedesk-setup-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    initialized,
    autoMode,
    repair,
    ignition,
    hooks,
    warnings: [...new Set(warnings)],
    next: [...new Set(next)]
  }
}

export function renderSetupReport(report: SetupReport): string {
  return [
    'ForgeDesk Setup',
    '',
    `Repo: ${displayPath(report.repoPath)}`,
    `Initialized: ${report.initialized ? 'yes' : 'no'}`,
    `Auto mode: ${report.autoMode}`,
    `Repair blockers: ${report.repair.blockers.length}`,
    report.ignition ? `Ignition: ${report.ignition.state}` : 'Ignition: skipped',
    report.hooks ? `Hooks: ${report.hooks.hooks.map((hook) => `${hook.name}:${hook.state}`).join(', ')}` : 'Hooks: skipped',
    '',
    '## Repaired',
    ...listLinesOrNone(report.repair.repaired),
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings),
    '',
    '## Next',
    ...listLinesOrNone(report.next),
    '',
    'Setup initializes local ForgeDesk files and explicit local entry points. It does not call AI, edit product code, run tests, commit, push, open PRs, tag, release, publish, upload, or install hooks/ignition unless those flags are explicitly used.'
  ].join('\n')
}
