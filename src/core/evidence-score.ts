import path from 'node:path'
import { captureGitSnapshot } from '../git/snapshot.js'
import type { ChangeSession } from '../types.js'
import { EVIDENCE_FILE_NAMES } from './constants.js'
import { evidenceCurrent } from './evidence-state.js'
import { pathExists } from './workspace.js'

export type EvidenceScoreDimension = {
  name: string
  label: string
  score: 0 | 1
}

export type EvidenceScore = {
  total: number
  max: number
  percent: number
  dimensions: EvidenceScoreDimension[]
}

const SCORE_MAX = 7

export function computeEvidenceScore(
  session: ChangeSession,
  opts: { evidenceFilesPresent: boolean; evidenceFresh: boolean }
): EvidenceScore {
  const dimensions: EvidenceScoreDimension[] = [
    {
      name: 'intent',
      label: 'Intent recorded',
      score: session.intent?.trim() ? 1 : 0
    },
    {
      name: 'tests',
      label: 'Tests recorded',
      score: session.tests.length > 0 && session.tests.some((t) => t.status !== 'failed') ? 1 : 0
    },
    {
      name: 'decisions',
      label: 'Decisions recorded',
      score: session.decisions.length > 0 ? 1 : 0
    },
    {
      name: 'risks',
      label: 'Risks recorded',
      score: session.risks.length > 0 ? 1 : 0
    },
    {
      name: 'manualChecks',
      label: 'Manual checks recorded',
      score: (session.manualChecks ?? []).length > 0 ? 1 : 0
    },
    {
      name: 'evidence',
      label: 'Evidence files complete',
      score: opts.evidenceFilesPresent ? 1 : 0
    },
    {
      name: 'freshness',
      label: 'Evidence fresh',
      score: opts.evidenceFresh ? 1 : 0
    }
  ]

  const total = dimensions.reduce((sum, d) => sum + d.score, 0)

  return {
    total,
    max: SCORE_MAX,
    percent: Math.round((total / SCORE_MAX) * 100),
    dimensions
  }
}

async function checkEvidenceFiles(repoPath: string, session: ChangeSession): Promise<boolean> {
  if (!session.evidenceDir) {
    return false
  }
  const evidenceDir = path.resolve(repoPath, session.evidenceDir)
  for (const file of EVIDENCE_FILE_NAMES) {
    if (!(await pathExists(path.join(evidenceDir, file)))) {
      return false
    }
  }
  return true
}

export async function getEvidenceScore(
  repoPath: string,
  session: ChangeSession
): Promise<EvidenceScore> {
  const evidenceFilesPresent = await checkEvidenceFiles(repoPath, session)
  let evidenceFresh = false

  if (evidenceFilesPresent && session.evidenceDir) {
    try {
      const snapshot = captureGitSnapshot(repoPath)
      evidenceFresh = await evidenceCurrent(repoPath, session, snapshot)
    } catch {
      evidenceFresh = false
    }
  }

  return computeEvidenceScore(session, { evidenceFilesPresent, evidenceFresh })
}
