import path from 'node:path'
import type { ChangeSession, Config, Project, Risk } from '../types.js'
import { gitRoot, isGitRepo, runGit } from '../git/snapshot.js'
import { ForgeDeskError } from './errors.js'
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

function now(): string {
  return new Date().toISOString()
}

function idPrefix(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function makeId(label: string): string {
  const slug = slugify(label) || 'session'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${idPrefix()}-${slug}-${suffix}`
}

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

  const timestamp = now()
  const defaultBranch = runGit(repoPath, ['branch', '--show-current']) || undefined
  const project: Project = {
    schemaVersion: 'forgedesk-project-v1',
    name: path.basename(repoPath),
    repoPath,
    defaultBranch,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  const config: Config = {
    schemaVersion: 'forgedesk-config-v1',
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
  const timestamp = now()
  const session: ChangeSession = {
    schemaVersion: 'forgedesk-session-v1',
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
    updatedAt: now()
  }))
}

export async function addDecision(text: string, cwd: string): Promise<ChangeSession> {
  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  const timestamp = now()
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
  const timestamp = now()
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
  const timestamp = now()
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
