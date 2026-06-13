import path from 'node:path'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import type { ChangeSession } from '../types.js'
import { readAutoConfig } from './auto-config.js'
import { getEpisodeStatus, type EpisodeStatusReport } from './episodes.js'
import { ForgeDeskError, isForgeDeskError } from './errors.js'
import { getInspectReport } from './inspect.js'
import { getReadyReport } from './ready.js'
import { getActiveSession, loadWorkspace, pathsFor, writeTextFile, type Workspace } from './workspace.js'

export type NowReport = {
  schemaVersion: 'forgedesk-now-v1'
  generatedAt: string
  repoPath: string
  path: string
  autoMode: string
  session?: {
    id: string
    title: string
    status: ChangeSession['status']
    evidenceDir?: string
  }
  episode?: {
    phase: EpisodeStatusReport['phase']
    summary: string
  }
  ready?: boolean
  inspectOk?: boolean
  exportDir?: string
  reviewContext?: string
  prBody?: string
  blockers: string[]
  warnings: string[]
  next: string[]
}

function nowPath(repoPath: string): string {
  return path.join(pathsFor(repoPath).forgedeskDir, 'NOW.md')
}

function sessionSummary(session: ChangeSession): NowReport['session'] {
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    evidenceDir: session.evidenceDir
  }
}

async function tryActiveSession(workspace: Workspace): Promise<ChangeSession | undefined> {
  try {
    return await getActiveSession(workspace)
  } catch (error) {
    if (isForgeDeskError(error, 'NO_ACTIVE_SESSION')) {
      return undefined
    }
    throw error
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function getNowReport(cwd: string): Promise<NowReport> {
  const workspace = await loadWorkspace(cwd)
  const autoConfig = await readAutoConfig(workspace)
  const blockers: string[] = []
  const warnings: string[] = []
  const next: string[] = []
  const session = await tryActiveSession(workspace)
  const episode = await getEpisodeStatus(cwd)

  let ready: boolean | undefined
  let inspectOk: boolean | undefined

  if (!session) {
    warnings.push('No active ForgeDesk session.')
    next.push('Run "forgedesk next" if you have local changes, or "forgedesk start --title <title>".')
  } else {
    if (!session.evidenceDir) {
      blockers.push('Active session has no generated evidence.')
      next.push('Run "forgedesk next" to generate evidence.')
    } else {
      try {
        const readyReport = await getReadyReport(cwd, session.id)
        ready = readyReport.ready
        blockers.push(...readyReport.blockers)
        warnings.push(...readyReport.warnings)
      } catch (error) {
        blockers.push(errorMessage(error))
      }

      try {
        const inspectReport = await getInspectReport(cwd, { sessionId: session.id, target: 'evidence' })
        inspectOk = inspectReport.ok
        blockers.push(...inspectReport.missingFiles.map((file) => `Evidence file is missing: ${file}.`))
      } catch (error) {
        blockers.push(errorMessage(error))
      }

      if (ready === true && inspectOk === true) {
        next.push('Run "forgedesk export" or "forgedesk next" to export ready evidence.')
      } else {
        next.push('Address blockers, then run "forgedesk next" again.')
      }
    }
  }

  const evidenceDir = session?.evidenceDir ? path.resolve(workspace.repoPath, session.evidenceDir) : undefined

  return {
    schemaVersion: 'forgedesk-now-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    path: nowPath(workspace.repoPath),
    autoMode: autoConfig.config.mode,
    session: session ? sessionSummary(session) : undefined,
    episode: {
      phase: episode.phase,
      summary: episode.summary
    },
    ready,
    inspectOk,
    exportDir: session ? path.join(pathsFor(workspace.repoPath).exportsDir, session.id) : undefined,
    reviewContext: evidenceDir ? path.join(evidenceDir, 'REVIEW_CONTEXT.md') : undefined,
    prBody: evidenceDir ? path.join(evidenceDir, 'PR_BODY.md') : undefined,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    next: [...new Set(next)]
  }
}

export function renderNowMarkdown(report: NowReport): string {
  return [
    '# ForgeDesk NOW',
    '',
    `Generated: ${report.generatedAt}`,
    `Repo: ${displayPath(report.repoPath)}`,
    `Auto mode: ${report.autoMode}`,
    report.session ? `Session: ${report.session.title}` : 'Session: None',
    report.session ? `Session ID: ${report.session.id}` : undefined,
    report.session ? `Session status: ${report.session.status}` : undefined,
    report.episode ? `Episode phase: ${report.episode.phase}` : undefined,
    report.episode ? `Episode summary: ${report.episode.summary}` : undefined,
    report.ready === undefined ? undefined : `Ready: ${report.ready ? 'yes' : 'no'}`,
    report.inspectOk === undefined ? undefined : `Inspect OK: ${report.inspectOk ? 'yes' : 'no'}`,
    report.session?.evidenceDir ? `Evidence: ${displayPath(report.session.evidenceDir)}` : undefined,
    report.exportDir ? `Export: ${displayPath(report.exportDir)}` : undefined,
    report.reviewContext ? `Review context: ${displayPath(report.reviewContext)}` : undefined,
    report.prBody ? `PR body: ${displayPath(report.prBody)}` : undefined,
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
    '## Boundary',
    '',
    'This file is local ForgeDesk status, not a review verdict. ForgeDesk does not call AI, edit product code, commit, push, open PRs, tag, release, publish, upload, or run as a hidden background service.',
    ''
  ].filter((line): line is string => line !== undefined).join('\n')
}

export async function refreshNowFile(cwd: string): Promise<NowReport> {
  const report = await getNowReport(cwd)
  await writeTextFile(report.path, renderNowMarkdown(report))
  return report
}

export function renderNowReport(report: NowReport): string {
  return [
    'ForgeDesk NOW',
    '',
    `Path: ${displayPath(report.path)}`,
    `Auto mode: ${report.autoMode}`,
    report.session ? `Session: ${report.session.title}` : 'Session: None',
    report.session ? `Session ID: ${report.session.id}` : undefined,
    report.episode ? `Episode phase: ${report.episode.phase}` : undefined,
    report.ready === undefined ? undefined : `Ready: ${report.ready ? 'yes' : 'no'}`,
    report.inspectOk === undefined ? undefined : `Inspect OK: ${report.inspectOk ? 'yes' : 'no'}`,
    '',
    '## Blockers',
    ...listLinesOrNone(report.blockers),
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings),
    '',
    '## Next',
    ...listLinesOrNone(report.next)
  ].filter((line): line is string => line !== undefined).join('\n')
}
