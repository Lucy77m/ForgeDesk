import path from 'node:path'
import type { ChangeSession } from '../types.js'
import { displayPath } from '../templates/format.js'
import { ForgeDeskError } from './errors.js'
import { getActiveSession, loadWorkspace, pathExists, readSession } from './workspace.js'

export type ReadyReport = {
  schemaVersion: 'forgedesk-ready-v1'
  generatedAt: string
  ready: boolean
  repoPath: string
  session: {
    id: string
    title: string
    status: ChangeSession['status']
  }
  blockers: string[]
  warnings: string[]
}

const evidenceFiles = [
  'PR_EVIDENCE.md',
  'CHANGE_SUMMARY.md',
  'TEST_RESULTS.md',
  'REVIEW_PROMPT.md',
  'evidence.json'
]

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function getSession(cwd: string, sessionId: string | undefined): Promise<{ repoPath: string; session: ChangeSession }> {
  const workspace = await loadWorkspace(cwd)
  if (!sessionId) {
    return {
      repoPath: workspace.repoPath,
      session: await getActiveSession(workspace)
    }
  }

  try {
    return {
      repoPath: workspace.repoPath,
      session: await readSession(workspace.repoPath, sessionId)
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new ForgeDeskError(`Unknown session: ${sessionId}`)
    }
    throw error
  }
}

async function missingEvidenceFiles(repoPath: string, session: ChangeSession): Promise<string[]> {
  if (!session.evidenceDir) {
    return evidenceFiles
  }

  const evidenceDir = path.resolve(repoPath, session.evidenceDir)
  const missing: string[] = []
  for (const file of evidenceFiles) {
    if (!(await pathExists(path.join(evidenceDir, file)))) {
      missing.push(file)
    }
  }
  return missing
}

export async function getReadyReport(cwd: string, sessionId?: string): Promise<ReadyReport> {
  const { repoPath, session } = await getSession(cwd, sessionId)
  const blockers: string[] = []
  const warnings: string[] = []

  if (!session.intent) {
    blockers.push('Intent is missing.')
  }

  if (session.tests.length === 0 && (session.manualChecks?.length ?? 0) === 0) {
    blockers.push('No test evidence or manual checks recorded.')
  }

  if (session.tests.some((test) => test.status === 'failed')) {
    blockers.push('At least one test command failed.')
  }

  if (!session.evidenceDir) {
    blockers.push('Evidence has not been generated.')
  }

  const missingFiles = await missingEvidenceFiles(repoPath, session)
  if (session.evidenceDir && missingFiles.length > 0) {
    blockers.push(`Evidence pack is missing: ${missingFiles.join(', ')}.`)
  }

  if (!session.gitSnapshot) {
    blockers.push('Git snapshot is missing. Generate evidence before handoff.')
  }

  if (!['needs-review', 'done'].includes(session.status)) {
    warnings.push(`Session status is ${session.status}; expected needs-review or done for handoff.`)
  }

  if (session.tests.length > 0 && session.tests.every((test) => test.status === 'recorded')) {
    warnings.push('Tests were recorded but not run by ForgeDesk.')
  }

  if (session.tests.length === 0 && (session.manualChecks?.length ?? 0) > 0) {
    warnings.push('No command tests recorded; readiness relies on manual checks.')
  }

  if (session.risks.length > 0) {
    warnings.push('Recorded risks still need human review.')
  }

  return {
    schemaVersion: 'forgedesk-ready-v1',
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    repoPath,
    session: {
      id: session.id,
      title: session.title,
      status: session.status
    },
    blockers,
    warnings
  }
}

function listOrNone(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- None']
}

export function renderReadyReport(report: ReadyReport): string {
  return [
    'ForgeDesk Ready',
    '',
    `Ready: ${report.ready ? 'yes' : 'no'}`,
    `Repo: ${report.repoPath}`,
    `Session: ${report.session.title}`,
    `Session ID: ${report.session.id}`,
    `Status: ${report.session.status}`,
    '',
    '## Blockers',
    ...listOrNone(report.blockers),
    '',
    '## Warnings',
    ...listOrNone(report.warnings),
    '',
    'This is an evidence readiness check, not a code correctness verdict.'
  ].map((line) => line.includes('\\') ? displayPath(line) : line).join('\n')
}
