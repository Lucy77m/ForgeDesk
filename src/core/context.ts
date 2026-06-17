import path from 'node:path'
import { captureGitSnapshot } from '../git/snapshot.js'
import {
  changedFileCount,
  displayPath,
  listLinesOrNone,
  renderChangedFiles,
  renderTestGroup,
  testSummary
} from '../templates/format.js'
import type { ChangeSession, GitSnapshot } from '../types.js'
import { getReadyReport, type ReadyReport } from './ready.js'
import { pathsFor, resolveSession, writeTextFile } from './workspace.js'

export type ContextOptions = {
  sessionId?: string
}

export type ContextReport = {
  schemaVersion: 'forgedesk-context-v1'
  generatedAt: string
  repoPath: string
  path: string
  session: {
    id: string
    title: string
    status: ChangeSession['status']
    intent?: string
  }
  ready: boolean
  blockers: string[]
  warnings: string[]
  next: string
}

function contextPath(repoPath: string): string {
  return path.join(pathsFor(repoPath).forgedeskDir, 'CONTEXT.md')
}

function nextAction(session: ChangeSession, ready: ReadyReport): string {
  if (!session.intent) {
    return 'Record the change intent with "forgedesk intent <text>".'
  }
  if (session.tests.length === 0 && (session.manualChecks?.length ?? 0) === 0) {
    return 'Record or run tests with "forgedesk test".'
  }
  if (session.tests.some((test) => test.status === 'failed')) {
    return 'Review failed tests with "forgedesk fix-context".'
  }
  if (!session.evidenceDir) {
    return 'Generate evidence with "forgedesk evidence".'
  }
  if (!ready.ready) {
    return 'Address readiness blockers, then run "forgedesk next".'
  }
  return 'Evidence is ready; run "forgedesk export" or "forgedesk next" to export.'
}

function recentCommitLines(snapshot: GitSnapshot): string[] {
  return snapshot.recentCommits.map(
    (commit) => `- ${commit.hash} ${commit.message}`
  )
}

function decisionLines(session: ChangeSession): string[] {
  return session.decisions.map((d) => `- ${d.text}`)
}

function riskLines(session: ChangeSession): string[] {
  return session.risks.map((r) => {
    const prefix = r.severity ? `[${r.severity}] ` : ''
    return `- ${prefix}${r.text}`
  })
}

function manualCheckLines(session: ChangeSession): string[] {
  return (session.manualChecks ?? []).map((c) => `- ${c.text}`)
}

export async function getContextReport(cwd: string, options: ContextOptions = {}): Promise<ContextReport> {
  const { workspace, session } = await resolveSession(cwd, options.sessionId)
  const ready = await getReadyReport(cwd, session.id)

  return {
    schemaVersion: 'forgedesk-context-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    path: contextPath(workspace.repoPath),
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      intent: session.intent
    },
    ready: ready.ready,
    blockers: ready.blockers,
    warnings: ready.warnings,
    next: nextAction(session, ready)
  }
}

export function renderContextMarkdown(report: ContextReport): string {
  return [
    '# ForgeDesk Context',
    '',
    `Generated: ${report.generatedAt}`,
    `Repo: ${displayPath(report.repoPath)}`,
    '',
    '## Session',
    '',
    `- ID: ${report.session.id}`,
    `- Title: ${report.session.title}`,
    `- Status: ${report.session.status}`,
    `- Intent: ${report.session.intent ?? 'Not recorded.'}`,
    ''
  ].join('\n')
}

export function renderContextReport(report: ContextReport): string {
  return [
    'ForgeDesk Context',
    '',
    `Path: ${displayPath(report.path)}`,
    `Session: ${report.session.title}`,
    `Session ID: ${report.session.id}`,
    `Status: ${report.session.status}`,
    `Intent: ${report.session.intent ?? 'Not recorded.'}`,
    `Ready: ${report.ready ? 'yes' : 'no'}`,
    '',
    '## Next',
    '',
    report.next,
    '',
    '## Blockers',
    ...listLinesOrNone(report.blockers),
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings)
  ].join('\n')
}

export async function refreshContextFile(cwd: string, options: ContextOptions = {}): Promise<ContextReport> {
  const { workspace, session } = await resolveSession(cwd, options.sessionId)
  const repoPath = workspace.repoPath
  const ready = await getReadyReport(cwd, session.id)
  const snapshot = session.gitSnapshot ?? captureGitSnapshot(repoPath)

  const lines: string[] = [
    '# ForgeDesk Context',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Repo: ${displayPath(repoPath)}`,
    '',
    '## Session',
    '',
    `- ID: ${session.id}`,
    `- Title: ${session.title}`,
    `- Status: ${session.status}`,
    `- Intent: ${session.intent ?? 'Not recorded.'}`,
    '',
    '## Git',
    '',
    `- Branch: ${snapshot.branch}`,
    `- HEAD: ${snapshot.head}`,
    `- Dirty: ${snapshot.isDirty ? 'yes' : 'no'}`,
    `- Changed files: ${changedFileCount(snapshot)}`,
    '',
    '## Changed Files',
    '',
    renderChangedFiles(snapshot),
    '',
    '## Recent Commits',
    '',
    ...listLinesOrNone(recentCommitLines(snapshot), 'No recent commits.'),
    '',
    '## Decisions',
    '',
    ...listLinesOrNone(decisionLines(session), 'None'),
    '',
    '## Risks',
    '',
    ...listLinesOrNone(riskLines(session), 'None'),
    '',
    '## Tests',
    '',
    testSummary(session),
    '',
    '### Test Details',
    '',
    renderTestGroup(session.tests),
    '',
    '## Manual Checks',
    '',
    ...listLinesOrNone(manualCheckLines(session), 'None'),
    '',
    '## Readiness',
    '',
    `Ready: ${ready.ready ? 'yes' : 'no'}`,
    '',
    'Blockers:',
    ...listLinesOrNone(ready.blockers, 'None'),
    '',
    'Warnings:',
    ...listLinesOrNone(ready.warnings, 'None'),
    '',
    '## Next',
    '',
    nextAction(session, ready),
    '',
    '## Boundary',
    '',
    'This file is local ForgeDesk context for AI or human consumption.',
    'It is not a code review verdict.',
    ''
  ]

  const filePath = contextPath(repoPath)
  await writeTextFile(filePath, lines.join('\n'))

  return {
    schemaVersion: 'forgedesk-context-v1',
    generatedAt: new Date().toISOString(),
    repoPath,
    path: filePath,
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      intent: session.intent
    },
    ready: ready.ready,
    blockers: ready.blockers,
    warnings: ready.warnings,
    next: nextAction(session, ready)
  }
}
