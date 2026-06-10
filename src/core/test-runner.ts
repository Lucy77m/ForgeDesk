import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { ChangeSession, TestRun } from '../types.js'
import { ForgeDeskError } from './errors.js'
import { getActiveSession, loadWorkspace, pathsFor, updateSession } from './workspace.js'

function now(): string {
  return new Date().toISOString()
}

function makeTestId(): string {
  return `test-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function summarizeOutput(output: string): string {
  const trimmed = output.trim()
  if (trimmed.length <= 4000) {
    return trimmed
  }

  return `${trimmed.slice(0, 1800)}\n\n... output truncated ...\n\n${trimmed.slice(-1800)}`
}

function toPortablePath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

async function appendTest(cwd: string, testRun: TestRun): Promise<ChangeSession> {
  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  return updateSession(workspace.repoPath, session.id, (current) => ({
    ...current,
    tests: [...current.tests, testRun],
    updatedAt: now()
  }))
}

export async function recordTestCommand(command: string, cwd: string): Promise<ChangeSession> {
  if (!command.trim()) {
    throw new ForgeDeskError('Test command is required.')
  }

  return appendTest(cwd, {
    id: makeTestId(),
    command: command.trim(),
    status: 'recorded'
  })
}

export async function runTestCommand(commandParts: string[], cwd: string): Promise<ChangeSession> {
  if (commandParts.length === 0) {
    throw new ForgeDeskError('Pass a command after "--" or use --command to record a test without running it.')
  }

  const workspace = await loadWorkspace(cwd)
  const session = await getActiveSession(workspace)
  const sessionId = session.id
  const command = commandParts.join(' ')
  const startedAt = now()
  const result = spawnSync(command, {
    cwd: workspace.repoPath,
    encoding: 'utf8',
    shell: true,
    windowsHide: true
  })
  const finishedAt = now()

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const combinedOutput = [stdout, stderr].filter(Boolean).join('\n')
  const testId = makeTestId()
  const paths = pathsFor(workspace.repoPath)
  await mkdir(paths.logsDir, { recursive: true })
  const logFile = path.join(paths.logsDir, `${testId}.log`)
  const errorMessage = result.error ? `\nProcess error: ${result.error.message}` : ''
  await writeFile(logFile, `${combinedOutput}${errorMessage}\n`, 'utf8')

  const exitCode = typeof result.status === 'number' ? result.status : 1
  const testRun: TestRun = {
    id: testId,
    command,
    exitCode,
    status: exitCode === 0 ? 'passed' : 'failed',
    startedAt,
    finishedAt,
    summary: summarizeOutput(`${combinedOutput}${errorMessage}`),
    logFile: toPortablePath(path.relative(workspace.repoPath, logFile))
  }

  return updateSession(workspace.repoPath, sessionId, (current) => ({
    ...current,
    tests: [...current.tests, testRun],
    updatedAt: finishedAt
  }))
}
