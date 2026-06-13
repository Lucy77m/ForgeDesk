import { displayPath, listLinesOrNone } from '../templates/format.js'
import type { AutoMode } from '../types.js'
import { readAutoConfig } from './auto-config.js'
import { ForgeDeskError, isForgeDeskError } from './errors.js'
import { getNextReport, renderNextReport, type NextReport } from './next.js'
import { loadWorkspace } from './workspace.js'

export type WatchStatus = 'idle' | 'suggested' | 'ran' | 'blocked' | 'error'

export type WatchOptions = {
  intervalMs?: number
}

export type WatchReport = {
  schemaVersion: 'forgedesk-watch-v1'
  generatedAt: string
  repoPath: string
  autoMode: AutoMode
  status: WatchStatus
  wroteFiles: boolean
  summary: string
  recommendation: string
  nextReport?: NextReport
  warnings: string[]
  blockers: string[]
}

export type WatchLoopOptions = WatchOptions & {
  json?: boolean
  onReport?: (report: WatchReport) => void
}

function now(): string {
  return new Date().toISOString()
}

function parseInterval(value: number | undefined): number {
  if (value === undefined) {
    return 2000
  }
  if (!Number.isFinite(value) || value < 500) {
    throw new ForgeDeskError('Watch interval must be at least 500 milliseconds.')
  }
  return Math.floor(value)
}

export function parseWatchInterval(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new ForgeDeskError('Watch interval must be a number of milliseconds.')
  }
  return parseInterval(parsed)
}

function ignorableNextError(error: unknown): boolean {
  return isForgeDeskError(error, 'NO_ACTIVE_SESSION') || isForgeDeskError(error, 'PROJECT_NOT_FOUND')
}

function idleReport(repoPath: string, autoMode: AutoMode, message: string): WatchReport {
  return {
    schemaVersion: 'forgedesk-watch-v1',
    generatedAt: now(),
    repoPath,
    autoMode,
    status: 'idle',
    wroteFiles: false,
    summary: message,
    recommendation: 'Make a local change or start a ForgeDesk session, then keep watch running.',
    warnings: [],
    blockers: []
  }
}

function errorReport(repoPath: string, autoMode: AutoMode, message: string): WatchReport {
  return {
    schemaVersion: 'forgedesk-watch-v1',
    generatedAt: now(),
    repoPath,
    autoMode,
    status: 'error',
    wroteFiles: false,
    summary: 'ForgeDesk watch could not evaluate the next local step.',
    recommendation: 'Run "forgedesk doctor" for details.',
    warnings: [message],
    blockers: []
  }
}

export async function getWatchReport(cwd: string): Promise<WatchReport> {
  const workspace = await loadWorkspace(cwd)
  const autoMode = (await readAutoConfig(workspace)).config.mode

  if (autoMode === 'manual') {
    return idleReport(
      workspace.repoPath,
      autoMode,
      'Watch is idle because auto mode is manual.'
    )
  }

  let preview: NextReport
  try {
    preview = await getNextReport(cwd, { dryRun: true })
  } catch (error) {
    if (ignorableNextError(error)) {
      return idleReport(
        workspace.repoPath,
        autoMode,
        'ForgeDesk watch found no active local evidence work.'
      )
    }
    const message = error instanceof Error ? error.message : String(error)
    return errorReport(workspace.repoPath, autoMode, message)
  }

  if (autoMode === 'assist') {
    return {
      schemaVersion: 'forgedesk-watch-v1',
      generatedAt: now(),
      repoPath: workspace.repoPath,
      autoMode,
      status: preview.action === 'blocked' ? 'blocked' : 'suggested',
      wroteFiles: false,
      summary: `Watch suggests the next local step: ${preview.action}.`,
      recommendation: preview.recommendation,
      nextReport: preview,
      warnings: preview.action === 'export' ? [] : [`Next action is ${preview.action} (${preview.reason}).`],
      blockers: preview.action === 'blocked' ? preview.blockers : []
    }
  }

  if (autoMode === 'guarded') {
    return {
      schemaVersion: 'forgedesk-watch-v1',
      generatedAt: now(),
      repoPath: workspace.repoPath,
      autoMode,
      status: preview.action === 'export' ? 'suggested' : 'blocked',
      wroteFiles: false,
      summary: preview.action === 'export'
        ? 'Watch sees evidence ready for export.'
        : 'Watch sees evidence that is not ready.',
      recommendation: preview.action === 'export'
        ? preview.recommendation
        : 'Run "forgedesk next" until evidence is ready, or change the auto profile.',
      nextReport: preview,
      warnings: preview.warnings,
      blockers: preview.action === 'export'
        ? []
        : preview.blockers.length > 0
          ? preview.blockers
          : [`Next action is ${preview.action} (${preview.reason}).`]
    }
  }

  if (preview.action === 'blocked') {
    return {
      schemaVersion: 'forgedesk-watch-v1',
      generatedAt: now(),
      repoPath: workspace.repoPath,
      autoMode,
      status: 'blocked',
      wroteFiles: false,
      summary: 'Watch stopped because readiness blockers prevent the next local step.',
      recommendation: preview.recommendation,
      nextReport: preview,
      warnings: preview.warnings,
      blockers: preview.blockers
    }
  }

  const actual = await getNextReport(cwd)
  return {
    schemaVersion: 'forgedesk-watch-v1',
    generatedAt: now(),
    repoPath: workspace.repoPath,
    autoMode,
    status: 'ran',
    wroteFiles: true,
    summary: `Watch ran one local-auto step: ${actual.action}.`,
    recommendation: actual.recommendation,
    nextReport: actual,
    warnings: actual.warnings,
    blockers: actual.blockers
  }
}

function reportKey(report: WatchReport): string {
  return JSON.stringify({
    status: report.status,
    recommendation: report.recommendation,
    action: report.nextReport?.action,
    reason: report.nextReport?.reason,
    outputDir: report.nextReport?.outputDir,
    blockers: report.blockers
  })
}

export async function startWatch(cwd: string, options: WatchLoopOptions = {}): Promise<never> {
  const intervalMs = parseInterval(options.intervalMs)
  let lastKey = ''

  const emit = async (): Promise<void> => {
    const report = await getWatchReport(cwd)
    const key = reportKey(report)
    if (key === lastKey) {
      return
    }
    lastKey = key
    if (options.onReport) {
      options.onReport(report)
      return
    }
    console.log(options.json ? JSON.stringify(report, null, 2) : renderWatchReport(report))
    console.log('')
  }

  await emit()
  setInterval(() => {
    emit().catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Error: ${message}`)
    })
  }, intervalMs)

  return new Promise<never>(() => undefined)
}

export function renderWatchReport(report: WatchReport): string {
  return [
    'ForgeDesk Watch',
    '',
    report.summary,
    '',
    `Status: ${report.status}`,
    `Auto mode: ${report.autoMode}`,
    `Wrote files: ${report.wroteFiles ? 'yes' : 'no'}`,
    `Recommended next: ${report.recommendation}`,
    `Repo: ${displayPath(report.repoPath)}`,
    '',
    '## Blockers',
    ...listLinesOrNone(report.blockers),
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings),
    report.nextReport ? '' : undefined,
    report.nextReport ? '## Next Preview' : undefined,
    report.nextReport ? renderNextReport(report.nextReport) : undefined
  ].filter((line): line is string => line !== undefined).join('\n')
}
