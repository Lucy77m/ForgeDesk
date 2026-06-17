import { spawnSync } from 'node:child_process'
import { platform } from 'node:os'
import path from 'node:path'
import { displayPath } from '../templates/format.js'
import { ForgeDeskError } from './errors.js'
import { pathExists, pathsFor, loadWorkspace, resolveSession } from './workspace.js'

export const OPEN_TARGETS = ['now', 'evidence', 'export', 'review-context', 'pr'] as const

export type OpenTarget = typeof OPEN_TARGETS[number]

export type OpenRunResult = {
  status: number | null
  stderr?: string
  error?: Error
}

export type OpenRunner = (command: string, args: string[]) => OpenRunResult

export type OpenReport = {
  target: OpenTarget
  path: string
}

export function parseOpenTarget(value: string | undefined): OpenTarget {
  if (!value) {
    return 'now'
  }
  if (OPEN_TARGETS.includes(value as OpenTarget)) {
    return value as OpenTarget
  }
  throw new ForgeDeskError(`Open target must be one of: ${OPEN_TARGETS.join(', ')}.`)
}

export function defaultOpenRunner(command: string, args: string[]): OpenRunResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true
  })

  return {
    status: result.status,
    stderr: result.stderr,
    error: result.error
  }
}

function openerCommand(filePath: string): { command: string; args: string[] } {
  switch (platform()) {
    case 'win32':
      return { command: 'cmd.exe', args: ['/c', 'start', '', filePath] }
    case 'darwin':
      return { command: 'open', args: [filePath] }
    default:
      return { command: 'xdg-open', args: [filePath] }
  }
}

async function assertTargetExists(target: OpenTarget, filePath: string): Promise<void> {
  if (!(await pathExists(filePath))) {
    throw new ForgeDeskError(`Cannot open ${target} because the target does not exist: ${displayPath(filePath)}.`)
  }
}

async function pathForTarget(cwd: string, target: OpenTarget): Promise<string> {
  const workspace = await loadWorkspace(cwd)
  const paths = pathsFor(workspace.repoPath)

  if (target === 'now') {
    return path.join(paths.forgedeskDir, 'NOW.md')
  }

  const { session } = await resolveSession(cwd)
  if (target === 'export') {
    return path.join(paths.exportsDir, session.id)
  }

  if (!session.evidenceDir) {
    throw new ForgeDeskError(`Cannot open ${target} because evidence has not been generated. Run "forgedesk evidence" first.`)
  }

  const evidenceDir = path.resolve(workspace.repoPath, session.evidenceDir)
  if (target === 'evidence') {
    return evidenceDir
  }
  if (target === 'review-context') {
    return path.join(evidenceDir, 'REVIEW_CONTEXT.md')
  }
  return path.join(evidenceDir, 'PR_BODY.md')
}

export async function openLocalTarget(
  cwd: string,
  target: OpenTarget = 'now',
  runner: OpenRunner = defaultOpenRunner
): Promise<OpenReport> {
  const targetPath = await pathForTarget(cwd, target)
  await assertTargetExists(target, targetPath)

  const { command, args } = openerCommand(targetPath)
  const result = runner(command, args)
  if (result.status !== 0 || result.error) {
    throw new ForgeDeskError(
      `Could not open ${target}. Details: ${result.error?.message || result.stderr?.trim() || `${command} exited with ${result.status ?? 'unknown status'}`}`
    )
  }

  return {
    target,
    path: displayPath(targetPath)
  }
}

export function renderOpenReport(report: OpenReport): string {
  return [
    'ForgeDesk Open',
    '',
    `Target: ${report.target}`,
    `Path: ${report.path}`,
    '',
    'This opens an existing local ForgeDesk file or directory. It does not generate evidence, upload, publish, or review code.'
  ].join('\n')
}
