export const PROJECT_SCHEMA_VERSION = 'forgedesk-project-v1'
export const CONFIG_SCHEMA_VERSION = 'forgedesk-config-v1'
export const SESSION_SCHEMA_VERSION = 'forgedesk-session-v1'
export const EVIDENCE_SCHEMA_VERSION = 'forgedesk-evidence-v1'

export type SourceLabel = {
  text: string
  source: string
  confidence: 'low' | 'medium' | 'high'
  confirmed: boolean
}

export type Project = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  name: string
  repoPath: string
  goal?: string
  defaultBranch?: string
  createdAt: string
  updatedAt: string
}

export type Config = {
  schemaVersion: typeof CONFIG_SCHEMA_VERSION
  activeSessionId?: string
  createdAt: string
  updatedAt: string
}

export type ChangeSession = {
  schemaVersion: typeof SESSION_SCHEMA_VERSION
  id: string
  title: string
  status: 'active' | 'needs-review' | 'done' | 'archived'
  intent?: string
  decisions: Decision[]
  risks: Risk[]
  tests: TestRun[]
  manualChecks?: ManualCheck[]
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

export type ManualCheck = {
  id: string
  text: string
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
  diffFingerprint?: string
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

export type RiskHint = {
  text: string
  source: string
  severity: 'low' | 'medium' | 'high'
  confidence: 'low' | 'medium' | 'high'
}

export type AutoCaptureMeta = {
  title?: SourceLabel
  intent?: SourceLabel
  riskHints: RiskHint[]
  checks: Array<{
    command: string
    status: 'recommended' | 'recorded' | 'passed' | 'failed' | 'not-run'
    source: string
  }>
  artifacts: {
    summary: string
    prBody: string
    reviewContext: string
    testEvidence: string
    rawEvidence: string
  }
}

export type EvidenceBundle = {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION
  generatedAt: string
  project: Project
  session: ChangeSession
  gitSnapshot: GitSnapshot
  autoCapture?: AutoCaptureMeta
}
