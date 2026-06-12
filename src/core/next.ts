import path from 'node:path'
import { captureGitSnapshot, gitRoot, isGitRepo } from '../git/snapshot.js'
import { readJson } from '../storage/json-store.js'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import type { ChangeSession, EvidenceBundle, GitSnapshot } from '../types.js'
import { runAutoCapture } from './auto.js'
import { generateEvidence } from './evidence.js'
import { ForgeDeskError, isForgeDeskError } from './errors.js'
import { exportEvidencePack } from './export.js'
import { getReadyReport } from './ready.js'
import { getActiveSession, loadWorkspace, pathExists, pathsFor, type Workspace } from './workspace.js'

export type NextAction = 'auto-capture' | 'generate-evidence' | 'blocked' | 'export'

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

function sortedFiles(files: string[]): string[] {
  return files.map((file) => file.replaceAll('\\', '/')).sort()
}

function sameFiles(left: string[], right: string[]): boolean {
  const normalizedLeft = sortedFiles(left)
  const normalizedRight = sortedFiles(right)
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((file, index) => file === normalizedRight[index])
}

function sameCapturedDiff(session: ChangeSession, snapshot: GitSnapshot): boolean {
  const captured = session.gitSnapshot
  if (!captured) {
    return false
  }
  return captured.branch === snapshot.branch &&
    captured.head === snapshot.head &&
    sameFiles(captured.modifiedFiles, snapshot.modifiedFiles) &&
    sameFiles(captured.addedFiles, snapshot.addedFiles) &&
    sameFiles(captured.deletedFiles, snapshot.deletedFiles) &&
    sameFiles(captured.untrackedFiles, snapshot.untrackedFiles)
}

async function evidenceCurrent(repoPath: string, session: ChangeSession): Promise<boolean> {
  if (!session.evidenceDir) {
    return false
  }

  const evidenceJson = path.resolve(repoPath, session.evidenceDir, 'evidence.json')
  if (!(await pathExists(evidenceJson))) {
    return false
  }

  try {
    const bundle = await readJson<EvidenceBundle>(evidenceJson)
    return bundle.generatedAt === session.updatedAt
  } catch {
    return false
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
  repoPath: string,
  dryRun: boolean,
  summary: string
): Omit<NextReport, 'blockers' | 'warnings' | 'next' | 'commands'> {
  return {
    schemaVersion: 'forgedesk-next-v1',
    generatedAt: new Date().toISOString(),
    action,
    dryRun,
    repoPath,
    summary
  }
}

async function autoCapture(cwd: string, repoPath: string, dryRun: boolean, session?: ChangeSession): Promise<NextReport> {
  if (dryRun) {
    return {
      ...baseReport('auto-capture', repoPath, true, 'ForgeDesk would capture local git changes and prepare review material.'),
      session: session ? sessionSummary(session) : undefined,
      blockers: [],
      warnings: ['Dry run only. No files were written.'],
      next: ['Run "forgedesk next" to auto-capture local changes.'],
      commands: ['forgedesk next']
    }
  }

  const report = await runAutoCapture(cwd, { noRun: true })
  return {
    ...baseReport('auto-capture', repoPath, false, 'Captured local changes and prepared review material.'),
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
  if (snapshot.isDirty && (!session || (session.evidenceDir && !sameCapturedDiff(session, snapshot)))) {
    return autoCapture(cwd, repoPath, dryRun, session)
  }

  if (!session) {
    throw new ForgeDeskError(
      'No active change session and no local changes to capture. Make a local change or run "forgedesk start --title <title>".',
      'NO_ACTIVE_SESSION'
    )
  }

  if (!session.evidenceDir || !(await evidenceCurrent(workspace.repoPath, session))) {
    const defaultOutputDir = displayPath(path.join(pathsFor(workspace.repoPath).evidenceDir, session.id))
    if (dryRun) {
      return {
        ...baseReport('generate-evidence', workspace.repoPath, true, 'ForgeDesk would generate or refresh the local evidence pack.'),
        session: sessionSummary(session),
        outputDir: defaultOutputDir,
        blockers: [],
        warnings: ['Dry run only. No files were written.'],
        next: ['Run "forgedesk next" to generate evidence.'],
        commands: ['forgedesk next']
      }
    }

    const outputDir = await generateEvidence(cwd, { sessionId: session.id })
    return {
      ...baseReport('generate-evidence', workspace.repoPath, false, 'Generated or refreshed the local evidence pack.'),
      session: {
        ...sessionSummary(session),
        status: 'needs-review'
      },
      outputDir: displayPath(outputDir),
      blockers: [],
      warnings: ['Evidence was generated. Run "forgedesk next" again to check readiness.'],
      next: ['Run "forgedesk next" again.'],
      commands: ['forgedesk next']
    }
  }

  const ready = await getReadyReport(cwd, session.id)
  if (!ready.ready) {
    const failedTestBlocker = ready.blockers.some((blocker) => blocker.toLowerCase().includes('test command failed'))
    return {
      ...baseReport('blocked', workspace.repoPath, dryRun, 'Evidence exists, but readiness blockers prevent export.'),
      session: ready.session,
      ready: false,
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
      ...baseReport('export', workspace.repoPath, true, 'ForgeDesk would export the ready evidence pack.'),
      session: sessionSummary(session),
      outputDir: displayPath(path.join(pathsFor(workspace.repoPath).exportsDir, session.id)),
      ready: true,
      blockers: [],
      warnings: ready.warnings,
      next: ['Run "forgedesk next" to export the ready evidence pack.'],
      commands: ['forgedesk next']
    }
  }

  const exported = await exportEvidencePack(cwd, { sessionId: session.id })
  return {
    ...baseReport('export', workspace.repoPath, false, 'Exported the ready evidence pack.'),
    session: {
      id: exported.session.id,
      title: exported.session.title,
      status: session.status
    },
    outputDir: exported.outputDir,
    ready: true,
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
    `Dry run: ${report.dryRun ? 'yes' : 'no'}`,
    `Repo: ${displayPath(report.repoPath)}`,
    report.session ? `Session: ${report.session.title}` : undefined,
    report.session ? `Session ID: ${report.session.id}` : undefined,
    report.session ? `Status: ${report.session.status}` : undefined,
    report.ready === undefined ? undefined : `Ready: ${report.ready ? 'yes' : 'no'}`,
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
