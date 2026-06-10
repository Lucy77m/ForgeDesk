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
  loadWorkspace,
  pathsFor,
  readSession,
  writeSession
} from './workspace.js'
import { writeFile } from 'node:fs/promises'

export type GenerateEvidenceOptions = {
  sessionId?: string
  outputDir?: string
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

  const updatedSession: ChangeSession = {
    ...session,
    status: 'needs-review',
    gitSnapshot: snapshot,
    evidenceDir: path.relative(workspace.repoPath, outputDir),
    updatedAt: bundle.generatedAt
  }
  await writeSession(workspace.repoPath, updatedSession)

  return outputDir
}
