import { access, mkdir, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import type { ChangeSession, Config, Project } from '../types.js'
import { updateJson, writeJson } from '../storage/json-store.js'
import { ForgeDeskError } from './errors.js'
import { assertSession, readChangeSession, readConfig, readProject } from './metadata.js'

export const FORGEDESK_DIR = '.forgedesk'
const PROJECT_NOT_FOUND_MESSAGE =
  'Could not find a ForgeDesk project. Run "forgedesk init --repo ." from a git repository first.'

export type Workspace = {
  repoPath: string
  forgedeskDir: string
  project: Project
  config: Config
}

export type ResolvedSession = {
  workspace: Workspace
  session: ChangeSession
}

export type WorkspacePaths = {
  forgedeskDir: string
  projectFile: string
  configFile: string
  sessionsDir: string
  evidenceDir: string
  exportsDir: string
  logsDir: string
}

export function resolveFrom(cwd: string, inputPath: string): string {
  return path.resolve(cwd, inputPath)
}

function forgedeskDirFor(repoPath: string): string {
  return path.join(repoPath, FORGEDESK_DIR)
}

export function pathsFor(repoPath: string): WorkspacePaths {
  const forgedeskDir = forgedeskDirFor(repoPath)
  return {
    forgedeskDir,
    projectFile: path.join(forgedeskDir, 'project.json'),
    configFile: path.join(forgedeskDir, 'config.json'),
    sessionsDir: path.join(forgedeskDir, 'sessions'),
    evidenceDir: path.join(forgedeskDir, 'evidence'),
    exportsDir: path.join(forgedeskDir, 'exports'),
    logsDir: path.join(forgedeskDir, 'logs')
  }
}

export function sessionFile(repoPath: string, sessionId: string): string {
  return path.join(pathsFor(repoPath).sessionsDir, `${sessionId}.json`)
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function hasForgeDeskProject(repoPath: string): Promise<boolean> {
  return pathExists(pathsFor(repoPath).projectFile)
}

function missingProjectError(): ForgeDeskError {
  return new ForgeDeskError(PROJECT_NOT_FOUND_MESSAGE)
}

export async function ensureForgeDeskDirs(repoPath: string): Promise<void> {
  const paths = pathsFor(repoPath)
  await mkdir(paths.sessionsDir, { recursive: true })
  await mkdir(paths.evidenceDir, { recursive: true })
  await mkdir(paths.exportsDir, { recursive: true })
  await mkdir(paths.logsDir, { recursive: true })
}

export async function findRepoWithForgeDesk(startPath: string): Promise<string> {
  let current = path.resolve(startPath)

  while (true) {
    if (await hasForgeDeskProject(current)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw missingProjectError()
    }
    current = parent
  }
}

async function readWorkspace(repoPath: string, paths: WorkspacePaths): Promise<Workspace> {
  return {
    repoPath,
    forgedeskDir: paths.forgedeskDir,
    project: await readProject(paths.projectFile),
    config: await readConfig(paths.configFile)
  }
}

export async function loadWorkspace(cwd: string): Promise<Workspace> {
  const repoPath = await findRepoWithForgeDesk(cwd)
  return readWorkspace(repoPath, pathsFor(repoPath))
}

export async function writeProject(repoPath: string, project: Project): Promise<void> {
  await writeJson(pathsFor(repoPath).projectFile, project)
}

export async function writeConfig(repoPath: string, config: Config): Promise<void> {
  await writeJson(pathsFor(repoPath).configFile, config)
}

export async function readSession(repoPath: string, sessionId: string): Promise<ChangeSession> {
  return readChangeSession(sessionFile(repoPath, sessionId))
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function unknownSessionError(sessionId: string): ForgeDeskError {
  return new ForgeDeskError(`Unknown session: ${sessionId}`)
}

async function readSessionOrThrow(repoPath: string, sessionId: string): Promise<ChangeSession> {
  try {
    return await readSession(repoPath, sessionId)
  } catch (error) {
    if (isNotFoundError(error)) {
      throw unknownSessionError(sessionId)
    }
    throw error
  }
}

function activeSessionIdOrThrow(workspace: Workspace): string {
  const activeSessionId = workspace.config.activeSessionId
  if (!activeSessionId) {
    throw new ForgeDeskError('No active change session. Run "forgedesk start --title <title>" first.')
  }
  return activeSessionId
}

function readResolvedSession(workspace: Workspace, sessionId?: string): Promise<ChangeSession> {
  return sessionId
    ? readSessionOrThrow(workspace.repoPath, sessionId)
    : getActiveSession(workspace)
}

export async function resolveSession(cwd: string, sessionId?: string): Promise<ResolvedSession> {
  const workspace = await loadWorkspace(cwd)
  return {
    workspace,
    session: await readResolvedSession(workspace, sessionId)
  }
}

export async function writeSession(repoPath: string, session: ChangeSession): Promise<void> {
  await writeJson(sessionFile(repoPath, session.id), session)
}

export async function updateSession(
  repoPath: string,
  sessionId: string,
  updater: (session: ChangeSession) => ChangeSession | Promise<ChangeSession>
): Promise<ChangeSession> {
  const filePath = sessionFile(repoPath, sessionId)
  return updateJson<ChangeSession>(filePath, async (value) => {
    const current = assertSession(value, filePath)
    const next = await updater(current)
    return assertSession(next, filePath)
  })
}

export async function listSessions(repoPath: string): Promise<ChangeSession[]> {
  const dir = pathsFor(repoPath).sessionsDir
  if (!(await pathExists(dir))) {
    return []
  }

  const files = await readdir(dir)
  const sessions = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map((file) => readChangeSession(path.join(dir, file)))
  )

  return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getActiveSession(workspace: Workspace): Promise<ChangeSession> {
  return readSession(workspace.repoPath, activeSessionIdOrThrow(workspace))
}
