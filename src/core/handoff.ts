import path from 'node:path'
import type { ChangeSession } from '../types.js'
import { changedFileCount, displayPath, testSummary } from '../templates/format.js'
import { EVIDENCE_FILE_NAMES } from './constants.js'
import { getReadyReport, type ReadyReport } from './ready.js'
import { resolveSession } from './workspace.js'

export type HandoffReport = {
  schemaVersion: 'forgedesk-handoff-v1'
  generatedAt: string
  repoPath: string
  session: {
    id: string
    title: string
    status: ChangeSession['status']
    intent?: string
    evidenceDir?: string
  }
  ready: ReadyReport
  summary: {
    tests: string
    decisions: number
    risks: number
    manualChecks: number
    changedFiles?: number
  }
  recommendedFiles: string[]
}

function recommendedFiles(session: ChangeSession): string[] {
  if (!session.evidenceDir) {
    return []
  }

  return EVIDENCE_FILE_NAMES.map((file) => displayPath(path.join(session.evidenceDir!, file)))
}

export async function getHandoffReport(cwd: string, sessionId?: string): Promise<HandoffReport> {
  const { workspace, session } = await resolveSession(cwd, sessionId)
  const repoPath = workspace.repoPath
  const ready = await getReadyReport(cwd, session.id)

  return {
    schemaVersion: 'forgedesk-handoff-v1',
    generatedAt: new Date().toISOString(),
    repoPath,
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      intent: session.intent,
      evidenceDir: session.evidenceDir ? displayPath(session.evidenceDir) : undefined
    },
    ready,
    summary: {
      tests: testSummary(session),
      decisions: session.decisions.length,
      risks: session.risks.length,
      manualChecks: session.manualChecks?.length ?? 0,
      changedFiles: session.gitSnapshot ? changedFileCount(session.gitSnapshot) : undefined
    },
    recommendedFiles: recommendedFiles(session)
  }
}

function listOrNone(items: string[], emptyText = 'None'): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${emptyText}`]
}

function countOrMissing(value: number | undefined): string {
  return typeof value === 'number' ? String(value) : 'missing'
}

export function renderHandoffReport(report: HandoffReport): string {
  return [
    'ForgeDesk Handoff',
    '',
    `Ready: ${report.ready.ready ? 'yes' : 'no'}`,
    `Repo: ${displayPath(report.repoPath)}`,
    `Session: ${report.session.title}`,
    `Session ID: ${report.session.id}`,
    `Status: ${report.session.status}`,
    `Intent: ${report.session.intent ?? 'Not recorded.'}`,
    `Evidence: ${report.session.evidenceDir ?? 'not generated'}`,
    '',
    '## Summary',
    `Tests: ${report.summary.tests}`,
    `Manual checks: ${report.summary.manualChecks}`,
    `Decisions: ${report.summary.decisions}`,
    `Risks: ${report.summary.risks}`,
    `Changed files: ${countOrMissing(report.summary.changedFiles)}`,
    '',
    '## Ready Blockers',
    ...listOrNone(report.ready.blockers),
    '',
    '## Ready Warnings',
    ...listOrNone(report.ready.warnings),
    '',
    '## Recommended Files',
    ...listOrNone(report.recommendedFiles, 'Generate evidence before handoff.'),
    '',
    'This is a local evidence handoff summary, not an AI review or code correctness verdict.'
  ].join('\n')
}
