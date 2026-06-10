import type { ChangeSession } from '../types.js'
import { listSessions, loadWorkspace } from './workspace.js'

type SessionsFilter = {
  status?: ChangeSession['status']
  all?: boolean
}

function formatSession(session: ChangeSession, activeSessionId: string | undefined): string {
  const marker = session.id === activeSessionId ? '*' : ' '
  const tests = session.tests.length
  const evidence = session.evidenceDir ? 'yes' : 'no'
  const manualChecks = session.manualChecks?.length ?? 0

  return `${marker} ${session.id} | ${session.status} | tests: ${tests} | checks: ${manualChecks} | evidence: ${evidence} | ${session.title}`
}

export async function getSessions(cwd: string, filter: SessionsFilter = {}): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const sessions = (await listSessions(workspace.repoPath)).filter((session) => {
    if (filter.status) {
      return session.status === filter.status
    }
    return filter.all ? true : session.status !== 'archived'
  })

  if (sessions.length === 0) {
    return filter.status
      ? `No ForgeDesk sessions with status: ${filter.status}.`
      : 'No ForgeDesk sessions yet. Start one with "forgedesk start --title <title>".'
  }

  return [
    'ForgeDesk Sessions',
    '',
    '* active session',
    filter.status ? `Filter: ${filter.status}` : filter.all ? 'Filter: all' : 'Filter: non-archived',
    '',
    ...sessions.map((session) => formatSession(session, workspace.config.activeSessionId))
  ].join('\n')
}
