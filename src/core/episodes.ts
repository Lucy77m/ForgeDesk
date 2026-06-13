import path from 'node:path'
import { captureGitSnapshot } from '../git/snapshot.js'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import type { ChangeSession } from '../types.js'
import { evidenceCurrent } from './evidence-state.js'
import { isForgeDeskError } from './errors.js'
import { getReadyReport } from './ready.js'
import { getActiveSession, loadWorkspace, pathExists, pathsFor, type Workspace } from './workspace.js'

export type EpisodePhase =
  | 'no-active-session'
  | 'draft'
  | 'needs-evidence'
  | 'stale-evidence'
  | 'needs-verification'
  | 'failed-tests'
  | 'ready'
  | 'exported'
  | 'done'

export type EpisodeStatusReport = {
  schemaVersion: 'forgedesk-episode-status-v1'
  generatedAt: string
  repoPath: string
  phase: EpisodePhase
  summary: string
  session?: {
    id: string
    title: string
    status: ChangeSession['status']
  }
  dirty: boolean
  evidenceFresh?: boolean
  exportDir?: string
  blockers: string[]
  warnings: string[]
  next: string[]
}

function sessionSummary(session: ChangeSession): EpisodeStatusReport['session'] {
  return {
    id: session.id,
    title: session.title,
    status: session.status
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

async function exportExists(repoPath: string, session: ChangeSession): Promise<boolean> {
  return pathExists(path.join(pathsFor(repoPath).exportsDir, session.id, 'HANDOFF.md'))
}

function reportForNoSession(repoPath: string, dirty: boolean): EpisodeStatusReport {
  return {
    schemaVersion: 'forgedesk-episode-status-v1',
    generatedAt: new Date().toISOString(),
    repoPath,
    phase: 'no-active-session',
    summary: dirty
      ? 'Local changes exist, but there is no active ForgeDesk episode.'
      : 'No active ForgeDesk episode is selected.',
    dirty,
    blockers: [],
    warnings: ['No active ForgeDesk session.'],
    next: dirty
      ? ['Run "forgedesk next" to capture this local change as a new episode.']
      : ['Make a local change and run "forgedesk next", or start a session manually.']
  }
}

export async function getEpisodeStatus(cwd: string): Promise<EpisodeStatusReport> {
  const workspace = await loadWorkspace(cwd)
  const snapshot = captureGitSnapshot(workspace.repoPath)
  const session = await tryActiveSession(workspace)

  if (!session) {
    return reportForNoSession(workspace.repoPath, snapshot.isDirty)
  }

  const base = {
    schemaVersion: 'forgedesk-episode-status-v1' as const,
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    session: sessionSummary(session),
    dirty: snapshot.isDirty
  }

  if (session.status === 'done' || session.status === 'archived') {
    return {
      ...base,
      phase: 'done',
      summary: 'The active episode is marked complete.',
      evidenceFresh: session.evidenceDir ? await evidenceCurrent(workspace.repoPath, session, snapshot) : undefined,
      exportDir: path.join(pathsFor(workspace.repoPath).exportsDir, session.id),
      blockers: [],
      warnings: session.status === 'archived' ? ['The active session is archived.'] : [],
      next: ['Run "forgedesk start --title <title>" or make a new local change and run "forgedesk next".']
    }
  }

  if (!session.evidenceDir) {
    return {
      ...base,
      phase: 'needs-evidence',
      summary: 'This episode has no generated evidence yet.',
      evidenceFresh: false,
      blockers: ['Evidence has not been generated.'],
      warnings: [],
      next: ['Run "forgedesk next" to generate evidence for this episode.']
    }
  }

  const fresh = await evidenceCurrent(workspace.repoPath, session, snapshot)
  if (!fresh) {
    return {
      ...base,
      phase: 'stale-evidence',
      summary: 'This episode evidence is stale for the current local diff.',
      evidenceFresh: false,
      blockers: ['Evidence is stale for the current local diff.'],
      warnings: [],
      next: ['Run "forgedesk next" to refresh episode evidence.']
    }
  }

  const ready = await getReadyReport(cwd, session.id)
  if (!ready.ready) {
    const failed = ready.blockers.some((blocker) => blocker.toLowerCase().includes('test command failed'))
    const missingVerification = ready.blockers.some((blocker) => blocker.toLowerCase().includes('no test evidence'))
    return {
      ...base,
      phase: failed ? 'failed-tests' : missingVerification ? 'needs-verification' : 'draft',
      summary: failed
        ? 'This episode has failed test evidence.'
        : missingVerification
          ? 'This episode needs test evidence or a manual check.'
          : 'This episode is still missing required handoff context.',
      evidenceFresh: true,
      blockers: ready.blockers,
      warnings: ready.warnings,
      next: failed
        ? ['Run "forgedesk fix-context", fix the issue, then run or record the relevant test.']
        : ['Address blockers, then run "forgedesk next" again.']
    }
  }

  const exported = await exportExists(workspace.repoPath, session)
  return {
    ...base,
    phase: exported ? 'exported' : 'ready',
    summary: exported
      ? 'This episode has ready evidence and an export.'
      : 'This episode is ready to export.',
    evidenceFresh: true,
    exportDir: path.join(pathsFor(workspace.repoPath).exportsDir, session.id),
    blockers: [],
    warnings: ready.warnings,
    next: exported
      ? ['Open the export directory, or start the next episode when this change is complete.']
      : ['Run "forgedesk next" to export this episode.']
  }
}

export function renderEpisodeStatus(report: EpisodeStatusReport): string {
  return [
    'ForgeDesk Episode',
    '',
    `Phase: ${report.phase}`,
    `Summary: ${report.summary}`,
    `Repo: ${displayPath(report.repoPath)}`,
    report.session ? `Session: ${report.session.title}` : 'Session: None',
    report.session ? `Session ID: ${report.session.id}` : undefined,
    report.session ? `Session status: ${report.session.status}` : undefined,
    `Dirty: ${report.dirty ? 'yes' : 'no'}`,
    report.evidenceFresh === undefined ? undefined : `Evidence fresh: ${report.evidenceFresh ? 'yes' : 'no'}`,
    report.exportDir ? `Export: ${displayPath(report.exportDir)}` : undefined,
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
    'An episode is the current local work segment around one ForgeDesk session. It is not a review verdict.'
  ].filter((line): line is string => line !== undefined).join('\n')
}
