import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { EVIDENCE_SCHEMA_VERSION, type AutoCaptureMeta, type ChangeSession, type EvidenceBundle } from '../types.js'
import { captureGitSnapshot } from '../git/snapshot.js'
import { writeJson } from '../storage/json-store.js'
import { renderChangeSummary } from '../templates/change-summary.js'
import { renderPrBody } from '../templates/pr-body.js'
import { renderPrEvidence } from '../templates/pr-evidence.js'
import { renderReviewContext } from '../templates/review-context.js'
import { renderReviewPrompt } from '../templates/review-prompt.js'
import { renderSummary } from '../templates/summary.js'
import { renderTestEvidence } from '../templates/test-evidence.js'
import { renderTestResults } from '../templates/test-results.js'
import { displayPath } from '../templates/format.js'
import { deriveRiskHintsAsync } from './risk-rules.js'
import { buildTemplateVars, isCustomizableTemplate, loadCustomTemplate, renderTemplate } from './templates.js'
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
  autoCapture?: Partial<Pick<AutoCaptureMeta, 'title' | 'intent' | 'checks'>>
}

type SessionWithEvidence = ChangeSession & { evidenceDir: string }

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

  const snapshot = captureGitSnapshot(workspace.repoPath)
  const bundle: EvidenceBundle = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    project: workspace.project,
    session: { ...session, gitSnapshot: snapshot },
    gitSnapshot: snapshot,
    autoCapture: {
      title: options.autoCapture?.title,
      intent: options.autoCapture?.intent,
      riskHints: await deriveRiskHintsAsync(workspace.repoPath, snapshot),
      checks: options.autoCapture?.checks ?? session.tests.map((test) => ({
        command: test.command,
        status: test.status,
        source: 'session:test'
      })),
      artifacts: {
        summary: 'SUMMARY.md',
        prBody: 'PR_BODY.md',
        reviewContext: 'REVIEW_CONTEXT.md',
        testEvidence: 'TEST_EVIDENCE.md',
        rawEvidence: 'PR_EVIDENCE.md'
      }
    }
  }

  const outputDir = options.outputDir
    ? path.resolve(cwd, options.outputDir)
    : path.join(pathsFor(workspace.repoPath).evidenceDir, session.id)
  await mkdir(outputDir, { recursive: true })

  const templateVars = buildTemplateVars(bundle)

  async function renderWithCustom(builtIn: () => string, fileName: string): Promise<string> {
    const custom = await loadCustomTemplate(workspace.repoPath, fileName)
    return custom ? renderTemplate(custom, templateVars) : builtIn()
  }

  await writeFile(path.join(outputDir, 'SUMMARY.md'), await renderWithCustom(() => renderSummary(bundle), 'SUMMARY.md'), 'utf8')
  await writeFile(path.join(outputDir, 'PR_BODY.md'), await renderWithCustom(() => renderPrBody(bundle), 'PR_BODY.md'), 'utf8')
  await writeFile(path.join(outputDir, 'REVIEW_CONTEXT.md'), await renderWithCustom(() => renderReviewContext(bundle), 'REVIEW_CONTEXT.md'), 'utf8')
  await writeFile(path.join(outputDir, 'TEST_EVIDENCE.md'), renderTestEvidence(bundle), 'utf8')
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
