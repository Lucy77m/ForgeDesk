import path from 'node:path'
import type { AutoCaptureMeta, ChangeSession, EvidenceBundle, RiskHint, SourceLabel } from '../types.js'
import { captureGitSnapshot, gitRoot, isGitRepo } from '../git/snapshot.js'
import { readJson } from '../storage/json-store.js'
import { changedFileCount, displayPath, listLinesOrNone } from '../templates/format.js'
import { generateEvidence } from './evidence.js'
import { EVIDENCE_FILE_NAMES } from './constants.js'
import { ForgeDeskError, isForgeDeskError } from './errors.js'
import { deriveRiskHints } from './risk-rules.js'
import { initProject, startSession } from './session.js'
import { getActiveSession, loadWorkspace, updateSession, type Workspace } from './workspace.js'

export type AutoCaptureOptions = {
  title?: string
  noRun?: boolean
  json?: boolean
}

export type AutoCaptureReport = {
  schemaVersion: 'forgedesk-auto-v1'
  generatedAt: string
  repoPath: string
  outputDir: string
  session: {
    id: string
    title: string
    status: ChangeSession['status']
  }
  changedFiles: number
  riskHints: RiskHint[]
  checks: string[]
  files: string[]
}

function projectNotFound(error: unknown): boolean {
  return isForgeDeskError(error, 'PROJECT_NOT_FOUND')
}

async function loadOrInitWorkspace(cwd: string): Promise<Workspace> {
  if (!isGitRepo(cwd)) {
    throw new ForgeDeskError(`Cannot auto capture because this is not a git repository: ${cwd}`, 'NOT_A_GIT_REPO')
  }

  try {
    return await loadWorkspace(cwd)
  } catch (error) {
    if (!projectNotFound(error)) {
      throw error
    }
    await initProject('.', cwd)
    return loadWorkspace(gitRoot(cwd))
  }
}

function titleFromBranch(branch: string): string | undefined {
  if (['main', 'master', 'HEAD'].includes(branch)) {
    return undefined
  }
  const words = branch
    .replace(/^refs\/heads\//, '')
    .replace(/^(feat|fix|chore|docs|refactor|test)\//, '')
    .replace(/[-_/.]+/g, ' ')
    .trim()
  return words ? words.replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined
}

function inferTitle(snapshot: EvidenceBundle['gitSnapshot']): string {
  const files = [
    ...snapshot.modifiedFiles,
    ...snapshot.addedFiles,
    ...snapshot.deletedFiles,
    ...snapshot.untrackedFiles
  ].map((file) => file.replaceAll('\\', '/'))

  const branchTitle = titleFromBranch(snapshot.branch)
  if (branchTitle) {
    return branchTitle
  }
  if (files.length > 0 && files.every((file) => file.startsWith('docs/') || file.endsWith('.md'))) {
    return 'Update documentation'
  }
  if (files.some((file) => file.startsWith('src/')) && files.some((file) => file.startsWith('tests/'))) {
    return 'Update implementation and tests'
  }
  if (files.some((file) => file.startsWith('src/'))) {
    return 'Update implementation'
  }
  if (files.some((file) => file === 'package.json' || file.endsWith('lock.yaml') || file.endsWith('lock.json'))) {
    return 'Update package metadata'
  }
  return `Capture ${files.length} local file change${files.length === 1 ? '' : 's'}`
}

function inferIntent(title: string, changedFiles: number): string {
  return `Prepare review context for ${title.toLowerCase()} across ${changedFiles} changed file${changedFiles === 1 ? '' : 's'}.`
}

function sourceLabel(text: string, source: string, confidence: SourceLabel['confidence']): SourceLabel {
  return {
    text,
    source,
    confidence,
    confirmed: false
  }
}

async function activeSessionForAuto(workspace: Workspace): Promise<ChangeSession | undefined> {
  if (!workspace.config.activeSessionId) {
    return undefined
  }
  try {
    const session = await getActiveSession(workspace)
    return session.status === 'active' && !session.evidenceDir ? session : undefined
  } catch (error) {
    if (isForgeDeskError(error, 'NO_ACTIVE_SESSION') || isForgeDeskError(error, 'SESSION_NOT_FOUND')) {
      return undefined
    }
    throw error
  }
}

async function resolveAutoSession(workspace: Workspace, cwd: string, title: string, intent: string): Promise<ChangeSession> {
  const active = await activeSessionForAuto(workspace)
  const session = active ?? await startSession(title, cwd)
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    title: current.title || title,
    intent: current.intent || intent,
    updatedAt: new Date().toISOString()
  }))
}

function checksForNoRun(): AutoCaptureMeta['checks'] {
  return [
    {
      command: 'checks',
      status: 'not-run',
      source: 'auto:no-run'
    }
  ]
}

function formatChecks(checks: AutoCaptureMeta['checks']): string[] {
  return checks.map((check) =>
    check.status === 'not-run'
      ? 'No checks executed (--no-run). Run or record tests before relying on this pack.'
      : `${check.command}: ${check.status} (${check.source})`
  )
}

export async function runAutoCapture(cwd: string, options: AutoCaptureOptions = {}): Promise<AutoCaptureReport> {
  const workspace = await loadOrInitWorkspace(cwd)
  const snapshot = captureGitSnapshot(workspace.repoPath)
  if (!snapshot.isDirty) {
    throw new ForgeDeskError('No local changes to auto capture.')
  }

  const title = options.title?.trim() || inferTitle(snapshot)
  const intent = inferIntent(title, changedFileCount(snapshot))
  const checkRecords = checksForNoRun()
  const session = await resolveAutoSession(workspace, cwd, title, intent)
  const outputDir = await generateEvidence(cwd, {
    sessionId: session.id,
    autoCapture: {
      title: sourceLabel(title, options.title ? 'user:option-title' : 'generated:branch-and-files', options.title ? 'high' : 'medium'),
      intent: sourceLabel(intent, 'generated:changed-files', 'medium'),
      checks: checkRecords
    }
  })
  const bundle = await readJson<EvidenceBundle>(path.join(outputDir, 'evidence.json'))

  return {
    schemaVersion: 'forgedesk-auto-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    outputDir: displayPath(outputDir),
    session: {
      id: session.id,
      title: session.title,
      status: 'needs-review'
    },
    changedFiles: changedFileCount(bundle.gitSnapshot),
    riskHints: bundle.autoCapture?.riskHints ?? deriveRiskHints(bundle.gitSnapshot),
    checks: formatChecks(bundle.autoCapture?.checks ?? checkRecords),
    files: EVIDENCE_FILE_NAMES.map((file) => displayPath(path.join(outputDir, file)))
  }
}

export function renderAutoCaptureReport(report: AutoCaptureReport): string {
  return [
    'ForgeDesk captured this change.',
    '',
    'Change:',
    report.session.title,
    '',
    'Scope:',
    `${report.changedFiles} changed file${report.changedFiles === 1 ? '' : 's'}`,
    '',
    'Checks:',
    ...listLinesOrNone(report.checks),
    '',
    'Risk hints:',
    ...listLinesOrNone(report.riskHints.map((hint) => `${hint.text} (${hint.source}, ${hint.severity})`), 'No risk hints generated.'),
    '',
    'Generated:',
    ...report.files.map((file) => `- ${file}`),
    '',
    'Next:',
    'Review SUMMARY.md first, then use REVIEW_CONTEXT.md with a human or AI reviewer.',
    '',
    'ForgeDesk prepares review context. It does not review or approve code.'
  ].join('\n')
}
