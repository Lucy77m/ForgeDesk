import path from 'node:path'
import type { ChangeSession } from '../types.js'
import { changedFileCount, displayPath, listLinesOrNone, testSummary } from '../templates/format.js'
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
  suggestedReviewOrder: string[]
  recommendedFiles: string[]
  commands: string[]
}

function recommendedFiles(session: ChangeSession): string[] {
  if (!session.evidenceDir) {
    return []
  }

  return EVIDENCE_FILE_NAMES.map((file) => displayPath(path.join(session.evidenceDir!, file)))
}

function suggestedReviewOrder(session: ChangeSession): string[] {
  if (!session.evidenceDir) {
    return []
  }

  return [
    path.join(session.evidenceDir, 'REVIEW_CONTEXT.md'),
    path.join(session.evidenceDir, 'PR_BODY.md'),
    path.join(session.evidenceDir, 'TEST_EVIDENCE.md'),
    path.join(session.evidenceDir, 'PR_EVIDENCE.md')
  ].map(displayPath)
}

function handoffCommands(session: ChangeSession): string[] {
  return [
    `forgedesk review-context --session ${session.id}`,
    `forgedesk pr --session ${session.id}`,
    `forgedesk ready --session ${session.id}`,
    `forgedesk inspect --session ${session.id}`
  ]
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
    suggestedReviewOrder: suggestedReviewOrder(session),
    recommendedFiles: recommendedFiles(session),
    commands: handoffCommands(session)
  }
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
    ...listLinesOrNone(report.ready.blockers),
    '',
    '## Ready Warnings',
    ...listLinesOrNone(report.ready.warnings),
    '',
    '## Suggested Review Order',
    ...listLinesOrNone(report.suggestedReviewOrder, 'Generate evidence before handoff.'),
    '',
    '## Recommended Files',
    ...listLinesOrNone(report.recommendedFiles, 'Generate evidence before handoff.'),
    '',
    '## Commands',
    ...listLinesOrNone(report.commands),
    '',
    'This is a local evidence handoff summary, not an AI review or code correctness verdict.'
  ].join('\n')
}
