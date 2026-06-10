export type Project = {
  schemaVersion: 'forgedesk-project-v1'
  name: string
  repoPath: string
  goal?: string
  defaultBranch?: string
  createdAt: string
  updatedAt: string
}

export type Config = {
  schemaVersion: 'forgedesk-config-v1'
  activeSessionId?: string
  createdAt: string
  updatedAt: string
}

export type ChangeSession = {
  schemaVersion: 'forgedesk-session-v1'
  id: string
  title: string
  status: 'active' | 'needs-review' | 'done' | 'archived'
  intent?: string
  decisions: Decision[]
  risks: Risk[]
  tests: TestRun[]
  gitSnapshot?: GitSnapshot
  evidenceDir?: string
  createdAt: string
  updatedAt: string
}

export type Decision = {
  id: string
  text: string
  createdAt: string
}

export type Risk = {
  id: string
  text: string
  severity?: 'low' | 'medium' | 'high'
  createdAt: string
}

export type TestRun = {
  id: string
  command: string
  exitCode?: number
  status: 'recorded' | 'passed' | 'failed'
  startedAt?: string
  finishedAt?: string
  summary?: string
  logFile?: string
}

export type GitSnapshot = {
  branch: string
  head: string
  isDirty: boolean
  modifiedFiles: string[]
  addedFiles: string[]
  deletedFiles: string[]
  untrackedFiles: string[]
  recentCommits: Array<{
    hash: string
    message: string
    date?: string
  }>
  capturedAt: string
}

export type EvidenceBundle = {
  schemaVersion: 'forgedesk-evidence-v1'
  generatedAt: string
  project: Project
  session: ChangeSession
  gitSnapshot: GitSnapshot
}
