import type { ChangeSession } from '../types.js'
import { listSessions, loadWorkspace } from './workspace.js'

function formatSession(session: ChangeSession, activeSessionId: string | undefined): string {
  const marker = session.id === activeSessionId ? '*' : ' '
  const tests = session.tests.length
  const evidence = session.evidenceDir ? 'yes' : 'no'

  return `${marker} ${session.id} | ${session.status} | tests: ${tests} | evidence: ${evidence} | ${session.title}`
}

export async function getSessions(cwd: string): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const sessions = await listSessions(workspace.repoPath)

  if (sessions.length === 0) {
    return 'No ForgeDesk sessions yet. Start one with "forgedesk start --title <title>".'
  }

  return [
    'ForgeDesk Sessions',
    '',
    '* active session',
    '',
    ...sessions.map((session) => formatSession(session, workspace.config.activeSessionId))
  ].join('\n')
}
