import { displayPath, listLinesOrNone } from '../templates/format.js'
import { getAutoConfigReport } from './auto-config.js'
import { getHooksStatus } from './hooks.js'
import { getIgnitionStatus } from './ignition.js'
import { refreshNowFile } from './now.js'
import { getShortcutsStatus, installShortcuts, type ShortcutsOptions } from './shortcuts.js'

type RepairAction = 'checked' | 'repaired' | 'skipped' | 'failed'

export type RepairStep = {
  name: string
  action: RepairAction
  status: string
  detail: string
}

export type RepairOptions = ShortcutsOptions

export type RepairReport = {
  schemaVersion: 'forgedesk-repair-v1'
  generatedAt: string
  repoPath: string
  steps: RepairStep[]
  repaired: string[]
  blockers: string[]
  warnings: string[]
  next: string[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function step(name: string, action: RepairAction, status: string, detail: string): RepairStep {
  return { name, action, status, detail }
}

function shortcutNeedsRepair(status: Awaited<ReturnType<typeof getShortcutsStatus>>, options: RepairOptions): boolean {
  if (status.vscode.state !== 'installed') {
    return true
  }
  if (options.packageScripts && status.packageScripts.state !== 'installed') {
    return true
  }
  if (options.testTasks && status.testTasks.state !== 'installed') {
    return true
  }
  return false
}

export async function repairLocalSetup(cwd: string, options: RepairOptions = {}): Promise<RepairReport> {
  const generatedAt = new Date().toISOString()
  const auto = await getAutoConfigReport(cwd)
  const repoPath = auto.repoPath
  const steps: RepairStep[] = [
    step('auto-config', 'checked', auto.config.mode, auto.source === 'default'
      ? 'Using the default manual auto profile.'
      : `Using auto profile from ${displayPath(auto.path)}.`)
  ]
  const repaired: string[] = []
  const blockers: string[] = []
  const warnings: string[] = []
  const next: string[] = []

  try {
    const now = await refreshNowFile(cwd)
    steps.push(step('now', 'repaired', 'refreshed', `Refreshed ${displayPath(now.path)}.`))
    repaired.push('now')
  } catch (error) {
    const message = errorMessage(error)
    steps.push(step('now', 'failed', 'error', message))
    blockers.push(message)
  }

  try {
    const shortcuts = await getShortcutsStatus(cwd, options)
    if (shortcutNeedsRepair(shortcuts, options)) {
      const installed = await installShortcuts(cwd, options)
      steps.push(step(
        'shortcuts',
        'repaired',
        installed.vscode.state,
        `Installed ForgeDesk editor shortcuts at ${displayPath(installed.vscode.path)}.`
      ))
      repaired.push('shortcuts')
      warnings.push(...installed.warnings)
    } else {
      steps.push(step('shortcuts', 'checked', shortcuts.vscode.state, 'ForgeDesk editor shortcuts are installed.'))
    }
  } catch (error) {
    const message = errorMessage(error)
    steps.push(step('shortcuts', 'failed', 'error', message))
    blockers.push(message)
  }

  try {
    const ignition = await getIgnitionStatus(cwd)
    steps.push(step('ignition', 'checked', ignition.state, `Use "forgedesk ignition install" to opt into folder-open watch.`))
    if (ignition.state === 'missing') {
      next.push('Run "forgedesk ignition install" if you want watch to start when the folder opens.')
    }
    warnings.push(...ignition.warnings)
  } catch (error) {
    const message = errorMessage(error)
    steps.push(step('ignition', 'failed', 'error', message))
    warnings.push(message)
  }

  try {
    const hooks = await getHooksStatus(cwd)
    const hookState = hooks.hooks.map((hook) => `${hook.name}:${hook.state}`).join(', ')
    steps.push(step('hooks', 'checked', hookState, 'Hooks are diagnostic-only in repair. Install them explicitly.'))
    if (hooks.hooks.some((hook) => hook.state === 'missing')) {
      next.push('Run "forgedesk hooks install" if you want git hook checks.')
    }
    warnings.push(...hooks.warnings)
  } catch (error) {
    const message = errorMessage(error)
    steps.push(step('hooks', 'failed', 'error', message))
    warnings.push(message)
  }

  if (options.testTasks) {
    next.push('Use your editor tasks named "ForgeDesk Test: ..." to run and record explicit test commands.')
  }
  next.push('Run "forgedesk next" to continue the local episode.')

  return {
    schemaVersion: 'forgedesk-repair-v1',
    generatedAt,
    repoPath,
    steps,
    repaired,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    next: [...new Set(next)]
  }
}

export function renderRepairReport(report: RepairReport): string {
  return [
    'ForgeDesk Repair',
    '',
    `Repo: ${displayPath(report.repoPath)}`,
    `Repaired: ${report.repaired.length > 0 ? report.repaired.join(', ') : 'none'}`,
    '',
    '## Steps',
    ...report.steps.map((item) => `- ${item.name}: ${item.action} (${item.status}) ${item.detail}`),
    '',
    '## Blockers',
    ...listLinesOrNone(report.blockers),
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings),
    '',
    '## Next',
    ...listLinesOrNone(report.next),
    '',
    'Repair only touches local ForgeDesk setup files such as NOW.md and explicit shortcuts. It does not call AI, edit product code, run tests, commit, push, open PRs, tag, release, publish, upload, or install hooks/ignition unless you run those commands explicitly.'
  ].join('\n')
}
