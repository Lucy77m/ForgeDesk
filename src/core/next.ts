import path from 'node:path'
import { captureGitSnapshot, gitRoot, isGitRepo } from '../git/snapshot.js'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import type { ChangeSession } from '../types.js'
import { runAutoCapture } from './auto.js'
import { evidenceCurrent } from './evidence-state.js'
import { getEvidenceScore, type EvidenceScore } from './evidence-score.js'
import { generateEvidence } from './evidence.js'
import { ForgeDeskError, isForgeDeskError } from './errors.js'
import { exportEvidencePack } from './export.js'
import { getReadyReport } from './ready.js'
import { getActiveSession, loadWorkspace, pathsFor, type Workspace } from './workspace.js'

export type NextAction = 'auto-capture' | 'generate-evidence' | 'blocked' | 'export'
export type NextReason =
  | 'dirty-no-session'
  | 'missing-evidence'
  | 'stale-evidence'
  | 'missing-tests'
  | 'failed-tests'
  | 'not-ready'
  | 'ready-to-export'
  | 'exported'

export type NextOptions = {
  dryRun?: boolean
}

type NextSession = {
  id: string
  title: string
  status: ChangeSession['status']
}

export type NextReport = {
  schemaVersion: 'forgedesk-next-v1'
  generatedAt: string
  action: NextAction
  dryRun: boolean
  repoPath: string
  summary: string
  reason: NextReason
  recommendation: string
  evidenceFresh?: boolean
  evidenceScore?: EvidenceScore
  session?: NextSession
  outputDir?: string
  ready?: boolean
  blockers: string[]
  warnings: string[]
  next: string[]
  commands: string[]
}

function projectNotFound(error: unknown): boolean {
  return isForgeDeskError(error, 'PROJECT_NOT_FOUND')
}

function noActiveSession(error: unknown): boolean {
  return isForgeDeskError(error, 'NO_ACTIVE_SESSION')
}

function sessionSummary(session: ChangeSession): NextSession {
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
    if (noActiveSession(error)) {
      return undefined
    }
    throw error
  }
}

function baseReport(
  action: NextAction,
  reason: NextReason,
  repoPath: string,
  dryRun: boolean,
  summary: string,
  recommendation: string
): Omit<NextReport, 'blockers' | 'warnings' | 'next' | 'commands'> {
  return {
    schemaVersion: 'forgedesk-next-v1',
    generatedAt: new Date().toISOString(),
    action,
    reason,
    dryRun,
    repoPath,
    summary,
    recommendation
  }
}

async function autoCapture(cwd: string, repoPath: string, dryRun: boolean, session?: ChangeSession): Promise<NextReport> {
  if (dryRun) {
    return {
      ...baseReport(
        'auto-capture',
        'dirty-no-session',
        repoPath,
        true,
        'ForgeDesk would capture local git changes and prepare review material.',
        'Run "forgedesk next" to auto-capture local changes.'
      ),
      session: session ? sessionSummary(session) : undefined,
      blockers: [],
      warnings: ['Dry run only. No files were written.'],
      next: ['Run "forgedesk next" to auto-capture local changes.'],
      commands: ['forgedesk next']
    }
  }

  const report = await runAutoCapture(cwd, { noRun: true })
  return {
    ...baseReport(
      'auto-capture',
      'dirty-no-session',
      repoPath,
      false,
      'Captured local changes and prepared review material.',
      'Run or record tests, then run "forgedesk next" again.'
    ),
    session: report.session,
    outputDir: report.outputDir,
    blockers: [],
    warnings: ['No checks were run. Record tests, then run "forgedesk next" again.'],
    next: ['Run or record tests with "forgedesk test -- <command>".', 'Run "forgedesk next" again.'],
    commands: ['forgedesk test -- <command>', 'forgedesk next']
  }
}

export async function getNextReport(cwd: string, options: NextOptions = {}): Promise<NextReport> {
  const dryRun = options.dryRun === true
  if (!isGitRepo(cwd)) {
    throw new ForgeDeskError(`Cannot run next because this is not a git repository: ${cwd}`, 'NOT_A_GIT_REPO')
  }

  const repoPath = gitRoot(cwd)
  const snapshot = captureGitSnapshot(repoPath)
  let workspace: Workspace

  try {
    workspace = await loadWorkspace(cwd)
  } catch (error) {
    if (projectNotFound(error) && snapshot.isDirty) {
      return autoCapture(cwd, repoPath, dryRun)
    }
    if (projectNotFound(error)) {
      throw new ForgeDeskError(
        'No ForgeDesk project or local changes to capture. Make a local change or run "forgedesk init --repo ." first.',
        'PROJECT_NOT_FOUND'
      )
    }
    throw error
  }

  const session = await tryActiveSession(workspace)
  if (snapshot.isDirty && !session) {
    return autoCapture(cwd, repoPath, dryRun, session)
  }

  if (!session) {
    throw new ForgeDeskError(
      'No active change session and no local changes to capture. Make a local change or run "forgedesk start --title <title>".',
      'NO_ACTIVE_SESSION'
    )
  }

  const currentEvidence = await evidenceCurrent(workspace.repoPath, session, snapshot)
  const evidenceScore = await getEvidenceScore(workspace.repoPath, session)
  if (!session.evidenceDir || !currentEvidence) {
    const defaultOutputDir = displayPath(path.join(pathsFor(workspace.repoPath).evidenceDir, session.id))
    if (dryRun) {
      return {
        ...baseReport(
          'generate-evidence',
          session.evidenceDir ? 'stale-evidence' : 'missing-evidence',
          workspace.repoPath,
          true,
          session.evidenceDir
            ? 'ForgeDesk would refresh stale evidence for the current local diff.'
            : 'ForgeDesk would generate or refresh the local evidence pack.',
          'Run "forgedesk next" to generate evidence.'
        ),
        session: sessionSummary(session),
        outputDir: defaultOutputDir,
        evidenceFresh: false,
        evidenceScore,
        blockers: [],
        warnings: session.evidenceDir
          ? ['Evidence is stale for the current local diff. Dry run only. No files were written.']
          : ['Dry run only. No files were written.'],
        next: ['Run "forgedesk next" to generate evidence.'],
        commands: ['forgedesk next']
      }
    }

    const outputDir = await generateEvidence(cwd, { sessionId: session.id })
    return {
      ...baseReport(
        'generate-evidence',
        session.evidenceDir ? 'stale-evidence' : 'missing-evidence',
        workspace.repoPath,
        false,
        'Generated or refreshed the local evidence pack.',
        'Run "forgedesk next" again.'
      ),
      session: {
        ...sessionSummary(session),
        status: 'needs-review'
      },
      outputDir: displayPath(outputDir),
      evidenceFresh: true,
      evidenceScore,
      blockers: [],
      warnings: ['Evidence was generated. Run "forgedesk next" again to check readiness.'],
      next: ['Run "forgedesk next" again.'],
      commands: ['forgedesk next']
    }
  }

  const ready = await getReadyReport(cwd, session.id)
  if (!ready.ready) {
    const failedTestBlocker = ready.blockers.some((blocker) => blocker.toLowerCase().includes('test command failed'))
    const missingTestsBlocker = ready.blockers.some((blocker) => blocker.toLowerCase().includes('no test evidence'))
    const recommendation = failedTestBlocker
      ? 'Run "forgedesk fix-context", address the failure, then run "forgedesk next" again.'
      : 'Address the blockers above, then run "forgedesk next" again.'
    return {
      ...baseReport(
        'blocked',
        failedTestBlocker ? 'failed-tests' : missingTestsBlocker ? 'missing-tests' : 'not-ready',
        workspace.repoPath,
        dryRun,
        'Evidence exists, but readiness blockers prevent export.',
        recommendation
      ),
      session: ready.session,
      ready: false,
      evidenceScore,
      blockers: ready.blockers,
      warnings: ready.warnings,
      next: failedTestBlocker
        ? ['Run "forgedesk fix-context" to print bounded failed-test context.', 'Address the blockers above, then run "forgedesk next" again.']
        : ['Address the blockers above, then run "forgedesk next" again.'],
      commands: failedTestBlocker ? ['forgedesk fix-context', 'forgedesk next'] : ['forgedesk next']
    }
  }

  if (dryRun) {
    return {
      ...baseReport(
        'export',
        'ready-to-export',
        workspace.repoPath,
        true,
        'ForgeDesk would export the ready evidence pack.',
        'Run "forgedesk next" to export the ready evidence pack.'
      ),
      session: sessionSummary(session),
      outputDir: displayPath(path.join(pathsFor(workspace.repoPath).exportsDir, session.id)),
      ready: true,
      evidenceScore,
      blockers: [],
      warnings: ready.warnings,
      next: ['Run "forgedesk next" to export the ready evidence pack.'],
      commands: ['forgedesk next']
    }
  }

  const exported = await exportEvidencePack(cwd, { sessionId: session.id })
  return {
    ...baseReport(
      'export',
      'exported',
      workspace.repoPath,
      false,
      'Exported the ready evidence pack.',
      'Open the export directory, or run "forgedesk review-context" / "forgedesk pr".'
    ),
    session: {
      id: exported.session.id,
      title: exported.session.title,
      status: session.status
    },
    outputDir: exported.outputDir,
    ready: true,
    evidenceScore,
    blockers: [],
    warnings: ready.warnings,
    next: ['Open the export directory, or run "forgedesk review-context" / "forgedesk pr".'],
    commands: ['forgedesk review-context', 'forgedesk pr']
  }
}

export function renderNextReport(report: NextReport): string {
  return [
    'ForgeDesk Next',
    '',
    report.summary,
    '',
    `Action: ${report.action}`,
    `Reason: ${report.reason}`,
    `Recommended next: ${report.recommendation}`,
    `Dry run: ${report.dryRun ? 'yes' : 'no'}`,
    `Repo: ${displayPath(report.repoPath)}`,
    report.session ? `Session: ${report.session.title}` : undefined,
    report.session ? `Session ID: ${report.session.id}` : undefined,
    report.session ? `Status: ${report.session.status}` : undefined,
    report.ready === undefined ? undefined : `Ready: ${report.ready ? 'yes' : 'no'}`,
    report.evidenceFresh === undefined ? undefined : `Evidence fresh: ${report.evidenceFresh ? 'yes' : 'no'}`,
    report.evidenceScore ? `Evidence Score: ${report.evidenceScore.total}/${report.evidenceScore.max} (${report.evidenceScore.percent}%)` : undefined,
    report.outputDir ? `Output: ${displayPath(report.outputDir)}` : undefined,
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
    '## Commands',
    ...listLinesOrNone(report.commands),
    '',
    'This is a local run button. It does not call AI, change product code, commit, push, open PRs, or release.'
  ].filter((line): line is string => line !== undefined).join('\n')
}
