import { access, mkdir, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import type { ChangeSession, Config, Project } from '../types.js'
import { readJson, writeJson } from '../storage/json-store.js'
import { ForgeDeskError } from './errors.js'

export const FORGEDESK_DIR = '.forgedesk'

export type Workspace = {
  repoPath: string
  forgedeskDir: string
  project: Project
  config: Config
}

export function resolveFrom(cwd: string, inputPath: string): string {
  return path.resolve(cwd, inputPath)
}

export function pathsFor(repoPath: string) {
  const forgedeskDir = path.join(repoPath, FORGEDESK_DIR)
  return {
    forgedeskDir,
    projectFile: path.join(forgedeskDir, 'project.json'),
    configFile: path.join(forgedeskDir, 'config.json'),
    sessionsDir: path.join(forgedeskDir, 'sessions'),
    evidenceDir: path.join(forgedeskDir, 'evidence'),
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

export async function ensureForgeDeskDirs(repoPath: string): Promise<void> {
  const paths = pathsFor(repoPath)
  await mkdir(paths.sessionsDir, { recursive: true })
  await mkdir(paths.evidenceDir, { recursive: true })
  await mkdir(paths.logsDir, { recursive: true })
}

export async function findRepoWithForgeDesk(startPath: string): Promise<string> {
  let current = path.resolve(startPath)

  while (true) {
    if (await pathExists(pathsFor(current).projectFile)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new ForgeDeskError(
        'Could not find a ForgeDesk project. Run "forgedesk init --repo ." from a git repository first.'
      )
    }
    current = parent
  }
}

export async function loadWorkspace(cwd: string): Promise<Workspace> {
  const repoPath = await findRepoWithForgeDesk(cwd)
  const paths = pathsFor(repoPath)
  return {
    repoPath,
    forgedeskDir: paths.forgedeskDir,
    project: await readJson<Project>(paths.projectFile),
    config: await readJson<Config>(paths.configFile)
  }
}

export async function writeProject(repoPath: string, project: Project): Promise<void> {
  await writeJson(pathsFor(repoPath).projectFile, project)
}

export async function writeConfig(repoPath: string, config: Config): Promise<void> {
  await writeJson(pathsFor(repoPath).configFile, config)
}

export async function readSession(repoPath: string, sessionId: string): Promise<ChangeSession> {
  return readJson<ChangeSession>(sessionFile(repoPath, sessionId))
}

export async function writeSession(repoPath: string, session: ChangeSession): Promise<void> {
  await writeJson(sessionFile(repoPath, session.id), session)
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
      .map((file) => readJson<ChangeSession>(path.join(dir, file)))
  )

  return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getActiveSession(workspace: Workspace): Promise<ChangeSession> {
  const activeSessionId = workspace.config.activeSessionId
  if (!activeSessionId) {
    throw new ForgeDeskError('No active change session. Run "forgedesk start --title <title>" first.')
  }

  return readSession(workspace.repoPath, activeSessionId)
}
