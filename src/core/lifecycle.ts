import type { ChangeSession } from '../types.js'
import { displayPath } from '../templates/format.js'
import { ForgeDeskError } from './errors.js'
import { nowIso } from './ids.js'
import {
  listSessions,
  loadWorkspace,
  resolveSession,
  updateSession,
  writeConfig
} from './workspace.js'

type SessionStatus = ChangeSession['status']

export async function markActiveSessionDone(cwd: string): Promise<ChangeSession> {
  const { workspace, session } = await resolveSession(cwd)
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    status: 'done',
    updatedAt: nowIso()
  }))
}

export async function archiveSession(cwd: string, sessionId: string | undefined): Promise<ChangeSession> {
  if (!sessionId) {
    throw new ForgeDeskError('Archive requires --session <id>.')
  }

  const { workspace, session } = await resolveSession(cwd, sessionId)
  const updated = await updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    status: 'archived',
    updatedAt: nowIso()
  }))

  if (workspace.config.activeSessionId === sessionId) {
    await writeConfig(workspace.repoPath, {
      ...workspace.config,
      activeSessionId: undefined,
      updatedAt: updated.updatedAt
    })
  }

  return updated
}

export async function reopenSession(cwd: string, sessionId: string | undefined): Promise<ChangeSession> {
  if (!sessionId) {
    throw new ForgeDeskError('Reopen requires --session <id>.')
  }

  const { workspace, session } = await resolveSession(cwd, sessionId)
  const timestamp = nowIso()
  const updated = await updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    status: 'active',
    updatedAt: timestamp
  }))

  await writeConfig(workspace.repoPath, {
    ...workspace.config,
    activeSessionId: sessionId,
    updatedAt: timestamp
  })

  return updated
}

function listItems(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- None'
}

function formatTests(session: ChangeSession): string {
  if (session.tests.length === 0) {
    return '- None'
  }

  return session.tests
    .map((test) => {
      const exitCode = typeof test.exitCode === 'number' ? `, exit ${test.exitCode}` : ''
      return `- ${test.status}: \`${test.command}\`${exitCode}`
    })
    .join('\n')
}

export async function showSession(cwd: string, sessionId: string | undefined): Promise<string> {
  const { session } = await resolveSession(cwd, sessionId)

  return [
    'ForgeDesk Session',
    '',
    `ID: ${session.id}`,
    `Title: ${session.title}`,
    `Status: ${session.status}`,
    `Intent: ${session.intent ?? 'Not recorded.'}`,
    `Evidence: ${session.evidenceDir ? displayPath(session.evidenceDir) : 'not generated'}`,
    '',
    '## Decisions',
    listItems(session.decisions.map((decision) => decision.text)),
    '',
    '## Risks',
    listItems(session.risks.map((risk) => `${risk.severity ? `[${risk.severity}] ` : ''}${risk.text}`)),
    '',
    '## Manual Checks',
    listItems((session.manualChecks ?? []).map((check) => check.text)),
    '',
    '## Tests',
    formatTests(session)
  ].join('\n')
}

export async function sessionExistsWithStatus(
  cwd: string,
  sessionId: string,
  status: SessionStatus
): Promise<boolean> {
  const workspace = await loadWorkspace(cwd)
  const sessions = await listSessions(workspace.repoPath)
  return sessions.some((session) => session.id === sessionId && session.status === status)
}
