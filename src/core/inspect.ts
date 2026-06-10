import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { ChangeSession } from '../types.js'
import { displayPath } from '../templates/format.js'
import { EVIDENCE_FILE_NAMES } from './constants.js'
import { ForgeDeskError } from './errors.js'
import { getReadyReport, type ReadyReport } from './ready.js'
import { getActiveSession, loadWorkspace, pathExists, pathsFor, readSession } from './workspace.js'

type InspectTarget = 'evidence' | 'export'

export type InspectFile = {
  name: string
  path: string
  exists: boolean
  sizeBytes?: number
}

export type InspectReport = {
  schemaVersion: 'forgedesk-inspect-v1'
  generatedAt: string
  repoPath: string
  target: InspectTarget
  targetDir: string
  session: {
    id: string
    title: string
    status: ChangeSession['status']
  }
  ready: ReadyReport
  ok: boolean
  files: InspectFile[]
  missingFiles: string[]
}

export type InspectOptions = {
  sessionId?: string
  target?: InspectTarget
}

const exportFiles = [...EVIDENCE_FILE_NAMES, 'HANDOFF.md']

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function getSession(cwd: string, sessionId: string | undefined) {
  const workspace = await loadWorkspace(cwd)
  if (!sessionId) {
    return {
      workspace,
      session: await getActiveSession(workspace)
    }
  }

  try {
    return {
      workspace,
      session: await readSession(workspace.repoPath, sessionId)
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new ForgeDeskError(`Unknown session: ${sessionId}`)
    }
    throw error
  }
}

function targetDirFor(repoPath: string, session: ChangeSession, target: InspectTarget): string {
  if (target === 'export') {
    return path.join(pathsFor(repoPath).exportsDir, session.id)
  }

  if (!session.evidenceDir) {
    throw new ForgeDeskError('Cannot inspect because evidence has not been generated. Run "forgedesk evidence" first.')
  }

  return path.resolve(repoPath, session.evidenceDir)
}

function expectedFilesFor(target: InspectTarget): readonly string[] {
  return target === 'export' ? exportFiles : EVIDENCE_FILE_NAMES
}

async function inspectFile(targetDir: string, name: string): Promise<InspectFile> {
  const filePath = path.join(targetDir, name)
  const fileStat = await stat(filePath).catch(() => undefined)

  return {
    name,
    path: displayPath(filePath),
    exists: Boolean(fileStat?.isFile()),
    sizeBytes: fileStat?.isFile() ? fileStat.size : undefined
  }
}

export async function getInspectReport(cwd: string, options: InspectOptions = {}): Promise<InspectReport> {
  const target = options.target ?? 'evidence'
  const { workspace, session } = await getSession(cwd, options.sessionId)
  const targetDir = targetDirFor(workspace.repoPath, session, target)

  if (!(await pathExists(targetDir))) {
    const command = target === 'export' ? 'forgedesk export' : 'forgedesk evidence'
    throw new ForgeDeskError(`Cannot inspect because ${target} directory was not found. Run "${command}" first.`)
  }

  const files = await Promise.all(expectedFilesFor(target).map((file) => inspectFile(targetDir, file)))
  const missingFiles = files.filter((file) => !file.exists).map((file) => file.name)
  const ready = await getReadyReport(cwd, session.id)

  return {
    schemaVersion: 'forgedesk-inspect-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    target,
    targetDir: displayPath(targetDir),
    session: {
      id: session.id,
      title: session.title,
      status: session.status
    },
    ready,
    ok: missingFiles.length === 0,
    files,
    missingFiles
  }
}

function listOrNone(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- None']
}

function formatFile(file: InspectFile): string {
  const size = typeof file.sizeBytes === 'number' ? `${file.sizeBytes} bytes` : 'missing'
  return `- ${file.exists ? 'ok' : 'missing'}: ${file.name} (${size})`
}

export function renderInspectReport(report: InspectReport): string {
  return [
    'ForgeDesk Inspect',
    '',
    `OK: ${report.ok ? 'yes' : 'no'}`,
    `Ready: ${report.ready.ready ? 'yes' : 'no'}`,
    `Target: ${report.target}`,
    `Directory: ${report.targetDir}`,
    `Session: ${report.session.title}`,
    `Session ID: ${report.session.id}`,
    `Status: ${report.session.status}`,
    '',
    '## Files',
    ...report.files.map(formatFile),
    '',
    '## Missing Files',
    ...listOrNone(report.missingFiles),
    '',
    'This is a read-only local evidence inspection. It does not generate, copy, upload, or review code.'
  ].join('\n')
}
