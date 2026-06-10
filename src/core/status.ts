import { captureGitSnapshot } from '../git/snapshot.js'
import type { ChangeSession } from '../types.js'
import { getActiveSession, listSessions, loadWorkspace } from './workspace.js'

function changedFileCount(snapshot: ReturnType<typeof captureGitSnapshot>): number {
  return (
    snapshot.modifiedFiles.length +
    snapshot.addedFiles.length +
    snapshot.deletedFiles.length +
    snapshot.untrackedFiles.length
  )
}

function nextAction(session: ChangeSession | undefined): string {
  if (!session) {
    return 'Start a change session with "forgedesk start --title <title>".'
  }
  if (!session.intent) {
    return 'Record the change intent with "forgedesk intent <text>".'
  }
  if (session.tests.length === 0) {
    return 'Record or run tests with "forgedesk test".'
  }
  if (session.tests.some((test) => test.status === 'failed')) {
    return 'Review failed tests before generating final evidence.'
  }
  if (!session.evidenceDir) {
    return 'Generate evidence with "forgedesk evidence".'
  }

  return 'Evidence has been generated; review the evidence pack before commit or handoff.'
}

export async function getStatus(cwd: string): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const snapshot = captureGitSnapshot(workspace.repoPath)
  const sessions = await listSessions(workspace.repoPath)
  const activeSession = workspace.config.activeSessionId ? await getActiveSession(workspace) : undefined
  const passedTests = activeSession?.tests.filter((test) => test.status === 'passed').length ?? 0
  const failedTests = activeSession?.tests.filter((test) => test.status === 'failed').length ?? 0
  const recordedTests = activeSession?.tests.filter((test) => test.status === 'recorded').length ?? 0

  return [
    'ForgeDesk Status',
    '',
    '## Project',
    `Project: ${workspace.project.name}`,
    `Session: ${activeSession ? activeSession.title : 'none'}`,
    `Sessions: ${sessions.length}`,
    `Evidence: ${activeSession?.evidenceDir ? activeSession.evidenceDir : 'not generated'}`,
    '',
    '## Git',
    `Branch: ${snapshot.branch}`,
    `HEAD: ${snapshot.head}`,
    `Dirty: ${snapshot.isDirty ? 'yes' : 'no'}`,
    `Changed files: ${changedFileCount(snapshot)}`,
    `Modified: ${snapshot.modifiedFiles.length}`,
    `Added: ${snapshot.addedFiles.length}`,
    `Deleted: ${snapshot.deletedFiles.length}`,
    `Untracked: ${snapshot.untrackedFiles.length}`,
    '',
    '## Evidence Readiness',
    `Intent: ${activeSession?.intent ? 'present' : 'missing'}`,
    `Decisions: ${activeSession?.decisions.length ?? 0}`,
    `Risks: ${activeSession?.risks.length ?? 0}`,
    `Tests: ${passedTests} passed, ${failedTests} failed, ${recordedTests} recorded`,
    '',
    '## Next',
    nextAction(activeSession)
  ].join('\n')
}
