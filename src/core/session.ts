import path from 'node:path'
import {
  CONFIG_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  SESSION_SCHEMA_VERSION,
  type ChangeSession,
  type Config,
  type Project,
  type Risk
} from '../types.js'
import { gitRoot, isGitRepo, runGit } from '../git/snapshot.js'
import { ForgeDeskError } from './errors.js'
import { makeId, nowIso } from './ids.js'
import {
  ensureForgeDeskDirs,
  getActiveSession,
  loadWorkspace,
  pathsFor,
  resolveFrom,
  updateSession,
  writeConfig,
  writeProject,
  writeSession
} from './workspace.js'

function requireText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new ForgeDeskError(`${label} text is required.`)
  }
  return trimmed
}

export async function initProject(repoInput: string, cwd: string): Promise<Project> {
  const requestedPath = resolveFrom(cwd, repoInput)

  if (!isGitRepo(requestedPath)) {
    throw new ForgeDeskError(`Cannot initialize ForgeDesk because this is not a git repository: ${requestedPath}`)
  }

  const repoPath = path.resolve(gitRoot(requestedPath))
  const paths = pathsFor(repoPath)
  await ensureForgeDeskDirs(repoPath)

  const timestamp = nowIso()
  const defaultBranch = runGit(repoPath, ['branch', '--show-current']) || undefined
  const project: Project = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name: path.basename(repoPath),
    repoPath,
    defaultBranch,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const config: Config = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  await writeProject(repoPath, project)
  await writeConfig(repoPath, config)
  await ensureForgeDeskDirs(repoPath)

  return project
}

export async function startSession(title: string, cwd: string): Promise<ChangeSession> {
  if (!title.trim()) {
    throw new ForgeDeskError('Session title is required.')
  }

  const workspace = await loadWorkspace(cwd)
  const timestamp = nowIso()
  const session: ChangeSession = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: makeId(title),
    title: title.trim(),
    status: 'active',
    decisions: [],
    risks: [],
    tests: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }

  await writeSession(workspace.repoPath, session)
  await writeConfig(workspace.repoPath, {
    ...workspace.config,
    activeSessionId: session.id,
    updatedAt: timestamp
  })

  return session
}

export async function setIntent(text: string, cwd: string): Promise<ChangeSession> {
  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    intent: requireText(text, 'Intent'),
    updatedAt: nowIso()
  }))
}

export async function addDecision(text: string, cwd: string): Promise<ChangeSession> {
  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  const timestamp = nowIso()
  const decisionText = requireText(text, 'Decision')
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    decisions: [...current.decisions, { id: makeId('decision'), text: decisionText, createdAt: timestamp }],
    updatedAt: timestamp
  }))
}

export async function addRisk(
  text: string,
  cwd: string,
  severity?: Risk['severity']
): Promise<ChangeSession> {
  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  const timestamp = nowIso()
  const riskText = requireText(text, 'Risk')
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    risks: [...current.risks, { id: makeId('risk'), text: riskText, severity, createdAt: timestamp }],
    updatedAt: timestamp
  }))
}

export async function addManualCheck(text: string, cwd: string): Promise<ChangeSession> {
  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  const timestamp = nowIso()
  const checkText = requireText(text, 'Manual check')
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    manualChecks: [
      ...(current.manualChecks ?? []),
      { id: makeId('check'), text: checkText, createdAt: timestamp }
    ],
    updatedAt: timestamp
  }))
}
