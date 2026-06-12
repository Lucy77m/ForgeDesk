import path from 'node:path'
import { captureGitSnapshot, gitRoot, isGitRepo } from '../git/snapshot.js'
import { readJson } from '../storage/json-store.js'
import { displayPath } from '../templates/format.js'
import type { ChangeSession, EvidenceBundle, GitSnapshot } from '../types.js'
import { runAutoCapture } from './auto.js'
import { generateEvidence } from './evidence.js'
import { ForgeDeskError } from './errors.js'
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
  session?: NextSession
  outputDir?: string
  ready?: boolean
  blockers: string[]
  warnings: string[]
  next: string[]
}

function projectNotFound(error: unknown): boolean {
  return error instanceof ForgeDeskError && error.message.startsWith('Could not find a ForgeDesk project.')
}

function noActiveSession(error: unknown): boolean {
  return error instanceof ForgeDeskError && error.message.startsWith('No active change session.')
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

function baseReport(action: NextAction, repoPath: string, dryRun: boolean): Omit<NextReport, 'blockers' | 'warnings' | 'next'> {
  return {
    schemaVersion: 'forgedesk-next-v1',
    generatedAt: new Date().toISOString(),
    action,
    dryRun,
    repoPath
  }
}

async function autoCapture(cwd: string, repoPath: string, dryRun: boolean, session?: ChangeSession): Promise<NextReport> {
  if (dryRun) {
    return {
      ...baseReport('auto-capture', repoPath, true),
      session: session ? sessionSummary(session) : undefined,
      blockers: [],
      warnings: ['Dry run only. No files were written.'],
      next: ['Run "forgedesk next" to auto-capture local changes.']
    }
  }

  const report = await runAutoCapture(cwd, { noRun: true })
  return {
    ...baseReport('auto-capture', repoPath, false),
    session: report.session,
    outputDir: report.outputDir,
    blockers: [],
    warnings: ['No checks were run. Record tests, then run "forgedesk next" again.'],
    next: ['Run or record tests with "forgedesk test -- <command>".', 'Run "forgedesk next" again.']
  }
}

export async function getNextReport(cwd: string, options: NextOptions = {}): Promise<NextReport> {
  const dryRun = options.dryRun === true
  if (!isGitRepo(cwd)) {
    throw new ForgeDeskError(`Cannot run next because this is not a git repository: ${cwd}`)
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
      throw new ForgeDeskError('No ForgeDesk project or local changes to capture. Make a local change or run "forgedesk init --repo ." first.')
    }
    throw error
  }

  const session = await tryActiveSession(workspace)
  if (snapshot.isDirty && (!session || (session.evidenceDir && !sameCapturedDiff(session, snapshot)))) {
    return autoCapture(cwd, repoPath, dryRun, session)
  }

  if (!session) {
    throw new ForgeDeskError('No active change session and no local changes to capture. Make a local change or run "forgedesk start --title <title>".')
  }

  if (!session.evidenceDir || !(await evidenceCurrent(workspace.repoPath, session))) {
    const defaultOutputDir = displayPath(path.join(pathsFor(workspace.repoPath).evidenceDir, session.id))
    if (dryRun) {
      return {
        ...baseReport('generate-evidence', workspace.repoPath, true),
        session: sessionSummary(session),
        outputDir: defaultOutputDir,
        blockers: [],
        warnings: ['Dry run only. No files were written.'],
        next: ['Run "forgedesk next" to generate evidence.']
      }
    }

    const outputDir = await generateEvidence(cwd, { sessionId: session.id })
    return {
      ...baseReport('generate-evidence', workspace.repoPath, false),
      session: {
        ...sessionSummary(session),
        status: 'needs-review'
      },
      outputDir: displayPath(outputDir),
      blockers: [],
      warnings: ['Evidence was generated. Run "forgedesk next" again to check readiness.'],
      next: ['Run "forgedesk next" again.']
    }
  }

  const ready = await getReadyReport(cwd, session.id)
  if (!ready.ready) {
    return {
      ...baseReport('blocked', workspace.repoPath, dryRun),
      session: ready.session,
      ready: false,
      blockers: ready.blockers,
      warnings: ready.warnings,
      next: ['Address the blockers above, then run "forgedesk next" again.']
    }
  }

  if (dryRun) {
    return {
      ...baseReport('export', workspace.repoPath, true),
      session: sessionSummary(session),
      outputDir: displayPath(path.join(pathsFor(workspace.repoPath).exportsDir, session.id)),
      ready: true,
      blockers: [],
      warnings: ready.warnings,
      next: ['Run "forgedesk next" to export the ready evidence pack.']
    }
  }

  const exported = await exportEvidencePack(cwd, { sessionId: session.id })
  return {
    ...baseReport('export', workspace.repoPath, false),
    session: {
      id: exported.session.id,
      title: exported.session.title,
      status: session.status
    },
    outputDir: exported.outputDir,
    ready: true,
    blockers: [],
    warnings: ready.warnings,
    next: ['Open the export directory, or run "forgedesk review-context" / "forgedesk pr".']
  }
}

function listOrNone(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- None']
}

export function renderNextReport(report: NextReport): string {
  return [
    'ForgeDesk Next',
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
    ...listOrNone(report.blockers),
    '',
    '## Warnings',
    ...listOrNone(report.warnings),
    '',
    '## Next',
    ...listOrNone(report.next),
    '',
    'This is a local run button. It does not call AI, change product code, commit, push, open PRs, or release.'
  ].filter((line): line is string => line !== undefined).join('\n')
}
