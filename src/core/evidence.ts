import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { ChangeSession, EvidenceBundle } from '../types.js'
import { captureGitSnapshot } from '../git/snapshot.js'
import { writeJson } from '../storage/json-store.js'
import { renderChangeSummary } from '../templates/change-summary.js'
import { renderPrEvidence } from '../templates/pr-evidence.js'
import { renderReviewPrompt } from '../templates/review-prompt.js'
import { renderTestResults } from '../templates/test-results.js'
import { ForgeDeskError } from './errors.js'
import {
  getActiveSession,
  listSessions,
  loadWorkspace,
  pathsFor,
  readSession,
  updateSession
} from './workspace.js'
import { writeFile } from 'node:fs/promises'

export type GenerateEvidenceOptions = {
  sessionId?: string
  outputDir?: string
}

type SessionWithEvidence = ChangeSession & { evidenceDir: string }

function displayPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

function sessionsWithEvidence(sessions: ChangeSession[]): SessionWithEvidence[] {
  return sessions
    .filter((session): session is SessionWithEvidence => Boolean(session.evidenceDir))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function formatEvidenceSession(session: SessionWithEvidence): string {
  return `${session.updatedAt} | ${session.status} | ${displayPath(session.evidenceDir)} | ${session.title} (${session.id})`
}

export async function generateEvidence(cwd: string, options: GenerateEvidenceOptions = {}): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const session = options.sessionId
    ? await readSession(workspace.repoPath, options.sessionId)
    : await getActiveSession(workspace)

  if (!session) {
    throw new ForgeDeskError('No session found for evidence generation.')
  }

  const snapshot = captureGitSnapshot(workspace.repoPath)
  const bundle: EvidenceBundle = {
    schemaVersion: 'forgedesk-evidence-v1',
    generatedAt: new Date().toISOString(),
    project: workspace.project,
    session: { ...session, gitSnapshot: snapshot },
    gitSnapshot: snapshot
  }

  const outputDir = options.outputDir
    ? path.resolve(cwd, options.outputDir)
    : path.join(pathsFor(workspace.repoPath).evidenceDir, session.id)
  await mkdir(outputDir, { recursive: true })

  await writeFile(path.join(outputDir, 'PR_EVIDENCE.md'), renderPrEvidence(bundle), 'utf8')
  await writeFile(path.join(outputDir, 'CHANGE_SUMMARY.md'), renderChangeSummary(bundle), 'utf8')
  await writeFile(path.join(outputDir, 'TEST_RESULTS.md'), renderTestResults(bundle), 'utf8')
  await writeFile(path.join(outputDir, 'REVIEW_PROMPT.md'), renderReviewPrompt(bundle), 'utf8')
  await writeJson(path.join(outputDir, 'evidence.json'), bundle)

  await updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    status: 'needs-review',
    gitSnapshot: snapshot,
    evidenceDir: path.relative(workspace.repoPath, outputDir),
    updatedAt: bundle.generatedAt
  }))

  return outputDir
}

export async function listEvidencePacks(cwd: string): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const sessions = sessionsWithEvidence(await listSessions(workspace.repoPath))

  if (sessions.length === 0) {
    return 'No ForgeDesk evidence packs yet. Generate one with "forgedesk evidence".'
  }

  return [
    'ForgeDesk Evidence Packs',
    '',
    ...sessions.map(formatEvidenceSession)
  ].join('\n')
}

export async function getLatestEvidencePack(cwd: string): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const latest = sessionsWithEvidence(await listSessions(workspace.repoPath))[0]

  if (!latest) {
    throw new ForgeDeskError('No ForgeDesk evidence packs yet. Generate one with "forgedesk evidence".')
  }

  return [
    'Latest ForgeDesk Evidence',
    '',
    `Session: ${latest.title}`,
    `Session ID: ${latest.id}`,
    `Status: ${latest.status}`,
    `Evidence: ${displayPath(latest.evidenceDir)}`,
    `Updated: ${latest.updatedAt}`
  ].join('\n')
}
