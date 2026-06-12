import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type { ChangeSession } from '../types.js'
import { readJson } from '../storage/json-store.js'
import { displayPath } from '../templates/format.js'
import { captureGitSnapshot } from '../git/snapshot.js'
import { EVIDENCE_FILE_NAMES } from './constants.js'
import { evidenceCurrent } from './evidence-state.js'
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
  recommendation: string
  activeSession?: {
    id: string
    title: string
    status: ChangeSession['status']
  }
  checks: DoctorCheck[]
}

type DoctorContext = {
  activeSession?: ChangeSession
  hasFailedTests: boolean
  missingEvidence: boolean
  staleEvidence: boolean
  missingVerification: boolean
}

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

function recommendationFor(checks: DoctorCheck[], context: DoctorContext): string {
  if (checks.some((item) => item.status === 'error')) {
    return 'Fix the error checks above, then run "forgedesk doctor" again.'
  }
  if (!context.activeSession) {
    return 'Run "forgedesk next" if you have local changes, or start a session with "forgedesk start --title <title>".'
  }
  if (context.hasFailedTests) {
    return 'Run "forgedesk fix-context", address the failed tests, then run "forgedesk next" again.'
  }
  if (context.missingEvidence || context.staleEvidence) {
    return 'Run "forgedesk next" to generate or refresh evidence.'
  }
  if (context.missingVerification) {
    return 'Run "forgedesk test -- <command>" or record a manual check, then run "forgedesk next" again.'
  }
  return 'Run "forgedesk next" to continue the local handoff flow.'
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

async function checkEvidence(
  repoPath: string,
  sessions: ChangeSession[],
  activeSessionId: string | undefined,
  checks: DoctorCheck[]
): Promise<void> {
  const sessionsWithEvidence = sessions.filter((session) => session.evidenceDir)

  if (sessionsWithEvidence.length === 0) {
    checks.push(check('evidence', 'warning', 'No generated evidence packs recorded in session metadata.'))
    return
  }

  let activeEvidenceErrors = 0
  let historicalEvidenceIssues = 0

  for (const session of sessionsWithEvidence) {
    const evidenceDir = path.resolve(repoPath, session.evidenceDir!)
    const missing: string[] = []
    for (const file of EVIDENCE_FILE_NAMES) {
      if (!(await pathExists(path.join(evidenceDir, file)))) {
        missing.push(file)
      }
    }

    if (missing.length === 0) {
      continue
    }

    if (session.id === activeSessionId) {
      activeEvidenceErrors += missing.length
      for (const file of missing) {
        checks.push(check('evidence', 'error', `${session.id}: missing ${file} in ${session.evidenceDir}.`))
      }
    } else {
      historicalEvidenceIssues += 1
    }
  }

  if (historicalEvidenceIssues > 0) {
    checks.push(check(
      'historicalEvidence',
      'warning',
      `${historicalEvidenceIssues} older evidence pack(s) are missing files expected by this ForgeDesk version.`
    ))
  }

  if (activeEvidenceErrors === 0) {
    checks.push(check(
      'evidence',
      'ok',
      activeSessionId
        ? 'Active evidence pack has expected files when evidence is recorded.'
        : `${sessionsWithEvidence.length} evidence pack(s) recorded.`
    ))
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
  let activeSession: ChangeSession | undefined
  const context: DoctorContext = {
    hasFailedTests: false,
    missingEvidence: false,
    staleEvidence: false,
    missingVerification: false
  }

  if (!activeSessionId) {
    checks.push(check('activeSession', 'warning', 'No active session configured.'))
  } else if (sessions.some((session) => session.id === activeSessionId)) {
    activeSession = sessions.find((session) => session.id === activeSessionId)
    context.activeSession = activeSession
    checks.push(check('activeSession', 'ok', `Active session exists: ${activeSessionId}.`))
  } else {
    checks.push(check('activeSession', 'error', `Active session is missing: ${activeSessionId}.`))
  }

  await checkEvidence(workspace.repoPath, sessions, activeSessionId, checks)

  if (activeSession) {
    context.hasFailedTests = activeSession.tests.some((test) => test.status === 'failed')
    context.missingVerification = activeSession.tests.length === 0 && (activeSession.manualChecks?.length ?? 0) === 0
    context.missingEvidence = !activeSession.evidenceDir

    if (context.hasFailedTests) {
      checks.push(check('activeTests', 'warning', 'Active session has failed tests.'))
    } else if (context.missingVerification) {
      checks.push(check('activeTests', 'warning', 'Active session has no test evidence or manual checks.'))
    } else {
      checks.push(check('activeTests', 'ok', 'Active session has verification evidence recorded.'))
    }

    if (!activeSession.evidenceDir) {
      checks.push(check('activeEvidence', 'warning', 'Active session has no generated evidence.'))
    } else {
      try {
        const snapshot = captureGitSnapshot(workspace.repoPath)
        context.staleEvidence = !(await evidenceCurrent(workspace.repoPath, activeSession, snapshot))
        checks.push(check(
          'activeEvidence',
          context.staleEvidence ? 'warning' : 'ok',
          context.staleEvidence
            ? 'Active session evidence is stale for the current local diff.'
            : 'Active session evidence matches the current local diff.'
        ))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        checks.push(check('git', 'error', `Could not capture git snapshot (${message}).`))
      }
    }
  }

  const recommendation = recommendationFor(checks, context)

  return {
    schemaVersion: 'forgedesk-doctor-v1',
    generatedAt: new Date().toISOString(),
    status: statusFor(checks),
    repoPath: workspace.repoPath,
    recommendation,
    activeSession: activeSession
      ? {
        id: activeSession.id,
        title: activeSession.title,
        status: activeSession.status
      }
      : undefined,
    checks
  }
}

export function renderDoctorReport(report: DoctorReport): string {
  return [
    'ForgeDesk Doctor',
    '',
    `Status: ${report.status}`,
    `Recommended next: ${report.recommendation}`,
    `Repo: ${report.repoPath}`,
    report.activeSession ? `Session: ${report.activeSession.title}` : undefined,
    report.activeSession ? `Session ID: ${report.activeSession.id}` : undefined,
    report.activeSession ? `Session status: ${report.activeSession.status}` : undefined,
    '',
    '## Checks',
    ...report.checks.map((item) => `- ${item.status}: ${item.name} - ${item.message}`)
  ].filter((line): line is string => line !== undefined).join('\n')
}
