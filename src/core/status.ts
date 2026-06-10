import { captureGitSnapshot } from '../git/snapshot.js'
import { getActiveSession, listSessions, loadWorkspace } from './workspace.js'

export async function getStatus(cwd: string): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const snapshot = captureGitSnapshot(workspace.repoPath)
  const sessions = await listSessions(workspace.repoPath)
  const activeSession = workspace.config.activeSessionId ? await getActiveSession(workspace) : undefined
  const passedTests = activeSession?.tests.filter((test) => test.status === 'passed').length ?? 0
  const failedTests = activeSession?.tests.filter((test) => test.status === 'failed').length ?? 0
  const recordedTests = activeSession?.tests.filter((test) => test.status === 'recorded').length ?? 0

  return [
    `Project: ${workspace.project.name}`,
    `Session: ${activeSession ? activeSession.title : 'none'}`,
    `Branch: ${snapshot.branch}`,
    `HEAD: ${snapshot.head}`,
    `Dirty: ${snapshot.isDirty ? 'yes' : 'no'}`,
    `Changed files: ${
      snapshot.modifiedFiles.length +
      snapshot.addedFiles.length +
      snapshot.deletedFiles.length +
      snapshot.untrackedFiles.length
    }`,
    `Intent: ${activeSession?.intent ? 'present' : 'missing'}`,
    `Decisions: ${activeSession?.decisions.length ?? 0}`,
    `Risks: ${activeSession?.risks.length ?? 0}`,
    `Tests: ${passedTests} passed, ${failedTests} failed, ${recordedTests} recorded`,
    `Evidence: ${activeSession?.evidenceDir ? activeSession.evidenceDir : 'not generated'}`,
    `Sessions: ${sessions.length}`
  ].join('\n')
}
