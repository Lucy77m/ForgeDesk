import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type { ChangeSession } from '../types.js'
import { readJson } from '../storage/json-store.js'
import { validateConfig, validateProject, validateSession } from './metadata.js'
import { loadWorkspace, pathExists, pathsFor } from './workspace.js'

type DoctorStatus = 'ok' | 'warning' | 'error'

export type DoctorCheck = {
  name: string
  status: DoctorStatus
  message: string
}

export type DoctorReport = {
  schemaVersion: 'forgedesk-doctor-v1'
  generatedAt: string
  status: DoctorStatus
  repoPath: string
  checks: DoctorCheck[]
}

const evidenceFiles = [
  'PR_EVIDENCE.md',
  'CHANGE_SUMMARY.md',
  'TEST_RESULTS.md',
  'REVIEW_PROMPT.md',
  'evidence.json'
]

function statusFor(checks: DoctorCheck[]): DoctorStatus {
  if (checks.some((check) => check.status === 'error')) {
    return 'error'
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning'
  }
  return 'ok'
}

function check(name: string, status: DoctorStatus, message: string): DoctorCheck {
  return { name, status, message }
}

function displayPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

async function readSessionFiles(repoPath: string, checks: DoctorCheck[]): Promise<ChangeSession[]> {
  const sessionsDir = pathsFor(repoPath).sessionsDir
  const files = (await readdir(sessionsDir).catch(() => []))
    .filter((file) => file.endsWith('.json'))
    .sort()
  const sessions: ChangeSession[] = []

  for (const file of files) {
    const filePath = path.join(sessionsDir, file)
    try {
      const session = await readJson<ChangeSession>(filePath)
      const validationError = validateSession(session)
      if (validationError) {
        checks.push(check('sessions', 'error', `${file}: ${validationError}.`))
        continue
      }
      sessions.push(session)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      checks.push(check('sessions', 'error', `${file}: could not read JSON (${message}).`))
    }
  }

  checks.push(check('sessions', sessions.length > 0 ? 'ok' : 'warning', `${sessions.length} session file(s) readable.`))
  return sessions
}

async function checkEvidence(repoPath: string, sessions: ChangeSession[], checks: DoctorCheck[]): Promise<void> {
  const sessionsWithEvidence = sessions.filter((session) => session.evidenceDir)

  if (sessionsWithEvidence.length === 0) {
    checks.push(check('evidence', 'warning', 'No generated evidence packs recorded in session metadata.'))
    return
  }

  for (const session of sessionsWithEvidence) {
    const evidenceDir = path.resolve(repoPath, session.evidenceDir!)
    for (const file of evidenceFiles) {
      if (!(await pathExists(path.join(evidenceDir, file)))) {
        checks.push(check('evidence', 'error', `${session.id}: missing ${file} in ${session.evidenceDir}.`))
      }
    }
  }

  if (!checks.some((item) => item.name === 'evidence' && item.status === 'error')) {
    checks.push(check('evidence', 'ok', `${sessionsWithEvidence.length} evidence pack(s) have expected files.`))
  }
}

export async function getDoctorReport(cwd: string): Promise<DoctorReport> {
  const workspace = await loadWorkspace(cwd)
  const paths = pathsFor(workspace.repoPath)
  const checks: DoctorCheck[] = []
  const projectValidationError = validateProject(workspace.project)
  const configValidationError = validateConfig(workspace.config)

  checks.push(
    check(
      'project',
      projectValidationError ? 'error' : 'ok',
      projectValidationError ?? `Project metadata loaded for ${workspace.project.name}.`
    )
  )
  checks.push(
    check(
      'config',
      configValidationError ? 'error' : 'ok',
      configValidationError ?? 'Config metadata loaded.'
    )
  )

  for (const [name, dir] of [
    ['sessionsDir', paths.sessionsDir],
    ['evidenceDir', paths.evidenceDir],
    ['logsDir', paths.logsDir]
  ] as const) {
    checks.push(
      check(name, (await pathExists(dir)) ? 'ok' : 'error', `${name}: ${displayPath(path.relative(workspace.repoPath, dir))}`)
    )
  }

  const sessions = await readSessionFiles(workspace.repoPath, checks)
  const activeSessionId = workspace.config.activeSessionId
  if (!activeSessionId) {
    checks.push(check('activeSession', 'warning', 'No active session configured.'))
  } else if (sessions.some((session) => session.id === activeSessionId)) {
    checks.push(check('activeSession', 'ok', `Active session exists: ${activeSessionId}.`))
  } else {
    checks.push(check('activeSession', 'error', `Active session is missing: ${activeSessionId}.`))
  }

  await checkEvidence(workspace.repoPath, sessions, checks)

  return {
    schemaVersion: 'forgedesk-doctor-v1',
    generatedAt: new Date().toISOString(),
    status: statusFor(checks),
    repoPath: workspace.repoPath,
    checks
  }
}

export function renderDoctorReport(report: DoctorReport): string {
  return [
    'ForgeDesk Doctor',
    '',
    `Status: ${report.status}`,
    `Repo: ${report.repoPath}`,
    '',
    '## Checks',
    ...report.checks.map((item) => `- ${item.status}: ${item.name} - ${item.message}`)
  ].join('\n')
}
