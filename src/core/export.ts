import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { displayPath } from '../templates/format.js'
import { EVIDENCE_FILE_NAMES } from './constants.js'
import { ForgeDeskError } from './errors.js'
import { getHandoffReport, renderHandoffReport } from './handoff.js'
import { getActiveSession, loadWorkspace, pathExists, readSession, pathsFor } from './workspace.js'

export type ExportReport = {
  schemaVersion: 'forgedesk-export-v1'
  generatedAt: string
  repoPath: string
  outputDir: string
  session: {
    id: string
    title: string
    status: string
  }
  ready: boolean
  files: string[]
  handoffFile: string
}

export type ExportOptions = {
  sessionId?: string
  outputDir?: string
}

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

async function assertEvidenceFiles(sourceDir: string): Promise<void> {
  const missing: string[] = []
  for (const file of EVIDENCE_FILE_NAMES) {
    if (!(await pathExists(path.join(sourceDir, file)))) {
      missing.push(file)
    }
  }

  if (missing.length > 0) {
    throw new ForgeDeskError(`Cannot export because evidence is missing: ${missing.join(', ')}.`)
  }
}

function defaultOutputDir(repoPath: string, sessionId: string): string {
  return path.join(pathsFor(repoPath).exportsDir, sessionId)
}

export async function exportEvidencePack(cwd: string, options: ExportOptions = {}): Promise<ExportReport> {
  const { workspace, session } = await getSession(cwd, options.sessionId)
  if (!session.evidenceDir) {
    throw new ForgeDeskError('Cannot export because evidence has not been generated. Run "forgedesk evidence" first.')
  }

  const sourceDir = path.resolve(workspace.repoPath, session.evidenceDir)
  await assertEvidenceFiles(sourceDir)

  const outputDir = options.outputDir
    ? path.resolve(cwd, options.outputDir)
    : defaultOutputDir(workspace.repoPath, session.id)
  await mkdir(outputDir, { recursive: true })

  const copiedFiles: string[] = []
  for (const file of EVIDENCE_FILE_NAMES) {
    await copyFile(path.join(sourceDir, file), path.join(outputDir, file))
    copiedFiles.push(displayPath(path.join(outputDir, file)))
  }

  const handoff = await getHandoffReport(cwd, session.id)
  const handoffFile = path.join(outputDir, 'HANDOFF.md')
  await writeFile(handoffFile, `${renderHandoffReport(handoff)}\n`, 'utf8')

  return {
    schemaVersion: 'forgedesk-export-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    outputDir: displayPath(outputDir),
    session: {
      id: session.id,
      title: session.title,
      status: session.status
    },
    ready: handoff.ready.ready,
    files: [...copiedFiles, displayPath(handoffFile)],
    handoffFile: displayPath(handoffFile)
  }
}

export function renderExportReport(report: ExportReport): string {
  return [
    'ForgeDesk Export',
    '',
    `Ready: ${report.ready ? 'yes' : 'no'}`,
    `Output: ${report.outputDir}`,
    `Session: ${report.session.title}`,
    `Session ID: ${report.session.id}`,
    `Status: ${report.session.status}`,
    '',
    '## Files',
    ...report.files.map((file) => `- ${file}`),
    '',
    'This export copies local evidence files only. It does not upload, publish, or review code.'
  ].join('\n')
}
