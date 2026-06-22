import path from 'node:path'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import type { ChangeSession } from '../types.js'
import { readJson } from '../storage/json-store.js'
import { EVIDENCE_FILE_NAMES } from './constants.js'
import { pathExists, resolveSession } from './workspace.js'

export type CiValidateOptions = {
  sessionId?: string
}

type ValidateCheck = {
  name: string
  ok: boolean
  message: string
}

export type CiValidateReport = {
  schemaVersion: 'forgedesk-ci-validate-v1'
  generatedAt: string
  status: 'pass' | 'fail'
  repoPath: string
  session: {
    id: string
    title: string
  }
  checks: ValidateCheck[]
  errors: string[]
}

function check(name: string, ok: boolean, message: string): ValidateCheck {
  return { name, ok, message }
}

function isValidSessionStatus(value: unknown): boolean {
  return value === 'active' || value === 'needs-review' || value === 'done' || value === 'archived'
}

function isValidTestStatus(value: unknown): boolean {
  return value === 'recorded' || value === 'passed' || value === 'failed'
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export async function validateEvidence(
  repoPath: string,
  session: ChangeSession
): Promise<ValidateCheck[]> {
  const checks: ValidateCheck[] = []

  if (!session.evidenceDir) {
    checks.push(check('evidenceDir', false, 'Session has no evidenceDir.'))
    return checks
  }

  const evidenceDir = path.resolve(repoPath, session.evidenceDir)
  const evidenceJsonPath = path.join(evidenceDir, 'evidence.json')

  if (!(await pathExists(evidenceJsonPath))) {
    checks.push(check('evidenceJson', false, 'evidence.json not found.'))
    return checks
  }

  let bundle: Record<string, unknown>
  try {
    bundle = await readJson<Record<string, unknown>>(evidenceJsonPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    checks.push(check('evidenceJson', false, `evidence.json is not valid JSON: ${message}`))
    return checks
  }

  checks.push(check('evidenceJson', true, 'evidence.json is valid JSON.'))

  // schemaVersion
  if (bundle.schemaVersion === 'forgedesk-evidence-v1') {
    checks.push(check('schemaVersion', true, 'schemaVersion is forgedesk-evidence-v1.'))
  } else {
    checks.push(check('schemaVersion', false, `schemaVersion is "${bundle.schemaVersion}", expected "forgedesk-evidence-v1".`))
  }

  // project
  const project = bundle.project as Record<string, unknown> | undefined
  if (project && typeof project === 'object') {
    checks.push(check('project', true, 'project object is present.'))
  } else {
    checks.push(check('project', false, 'project is missing or not an object.'))
  }

  // session
  const sessionData = bundle.session as Record<string, unknown> | undefined
  if (sessionData && typeof sessionData === 'object') {
    checks.push(check('session', true, 'session object is present.'))

    if (isValidSessionStatus(sessionData.status)) {
      checks.push(check('session.status', true, `session.status is "${sessionData.status}".`))
    } else {
      checks.push(check('session.status', false, `session.status is "${sessionData.status}", expected active/needs-review/done/archived.`))
    }

    if (Array.isArray(sessionData.tests)) {
      const invalidTest = sessionData.tests.find((t: unknown) => {
        const test = t as Record<string, unknown>
        return !isValidTestStatus(test.status)
      })
      if (invalidTest) {
        checks.push(check('session.tests', false, 'session.tests contains an entry with invalid status.'))
      } else {
        checks.push(check('session.tests', true, `session.tests has ${sessionData.tests.length} entries with valid statuses.`))
      }
    } else {
      checks.push(check('session.tests', false, 'session.tests is not an array.'))
    }
  } else {
    checks.push(check('session', false, 'session is missing or not an object.'))
  }

  // gitSnapshot
  const snapshot = bundle.gitSnapshot as Record<string, unknown> | undefined
  if (snapshot && typeof snapshot === 'object') {
    checks.push(check('gitSnapshot', true, 'gitSnapshot object is present.'))

    const arrayFields = ['modifiedFiles', 'addedFiles', 'deletedFiles', 'untrackedFiles']
    for (const field of arrayFields) {
      if (isStringArray(snapshot[field])) {
        checks.push(check(`gitSnapshot.${field}`, true, `gitSnapshot.${field} is a string array.`))
      } else {
        checks.push(check(`gitSnapshot.${field}`, false, `gitSnapshot.${field} is not a string array.`))
      }
    }

    if (Array.isArray(snapshot.recentCommits)) {
      checks.push(check('gitSnapshot.recentCommits', true, `gitSnapshot.recentCommits has ${snapshot.recentCommits.length} entries.`))
    } else {
      checks.push(check('gitSnapshot.recentCommits', false, 'gitSnapshot.recentCommits is not an array.'))
    }
  } else {
    checks.push(check('gitSnapshot', false, 'gitSnapshot is missing or not an object.'))
  }

  // evidence files
  const missing: string[] = []
  for (const file of EVIDENCE_FILE_NAMES) {
    if (!(await pathExists(path.join(evidenceDir, file)))) {
      missing.push(file)
    }
  }
  if (missing.length === 0) {
    checks.push(check('evidenceFiles', true, `All ${EVIDENCE_FILE_NAMES.length} evidence files present.`))
  } else {
    checks.push(check('evidenceFiles', false, `Missing evidence files: ${missing.join(', ')}.`))
  }

  return checks
}

export async function getCiValidateReport(cwd: string, options: CiValidateOptions = {}): Promise<CiValidateReport> {
  const { workspace, session } = await resolveSession(cwd, options.sessionId)
  const checks = await validateEvidence(workspace.repoPath, session)
  const errors = checks.filter((c) => !c.ok).map((c) => c.message)
  const status = errors.length === 0 ? 'pass' : 'fail'

  return {
    schemaVersion: 'forgedesk-ci-validate-v1',
    generatedAt: new Date().toISOString(),
    status,
    repoPath: workspace.repoPath,
    session: {
      id: session.id,
      title: session.title
    },
    checks,
    errors
  }
}

export function renderCiValidateReport(report: CiValidateReport): string {
  return [
    'ForgeDesk CI Validate',
    '',
    `Status: ${report.status}`,
    `Session: ${report.session.title}`,
    `Session ID: ${report.session.id}`,
    `Repo: ${displayPath(report.repoPath)}`,
    '',
    '## Checks',
    ...report.checks.map((c) => `- ${c.ok ? 'pass' : 'fail'}: ${c.name} - ${c.message}`),
    '',
    '## Errors',
    ...listLinesOrNone(report.errors),
    '',
    'This is a local evidence structure validation. It does not call AI, review code, or modify files.'
  ].join('\n')
}
