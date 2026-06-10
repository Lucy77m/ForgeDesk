import type { ChangeSession } from '../types.js'
import { displayPath } from '../templates/format.js'
import { ForgeDeskError } from './errors.js'
import {
  getActiveSession,
  listSessions,
  loadWorkspace,
  readSession,
  updateSession,
  writeConfig
} from './workspace.js'

type SessionStatus = ChangeSession['status']

function now(): string {
  return new Date().toISOString()
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function readSessionOrThrow(repoPath: string, sessionId: string): Promise<ChangeSession> {
  try {
    return await readSession(repoPath, sessionId)
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new ForgeDeskError(`Unknown session: ${sessionId}`)
    }
    throw error
  }
}

export async function markActiveSessionDone(cwd: string): Promise<ChangeSession> {
  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    status: 'done',
    updatedAt: now()
  }))
}

export async function archiveSession(cwd: string, sessionId: string | undefined): Promise<ChangeSession> {
  if (!sessionId) {
    throw new ForgeDeskError('Archive requires --session <id>.')
  }

  const workspace = await loadWorkspace(cwd)
  const session = await readSessionOrThrow(workspace.repoPath, sessionId)
  const updated = await updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    status: 'archived',
    updatedAt: now()
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

  const workspace = await loadWorkspace(cwd)
  const session = await readSessionOrThrow(workspace.repoPath, sessionId)
  const timestamp = now()
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
  const workspace = await loadWorkspace(cwd)
  const session = sessionId
    ? await readSessionOrThrow(workspace.repoPath, sessionId)
    : await getActiveSession(workspace)

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
