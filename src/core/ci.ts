import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { captureGitSnapshot } from '../git/snapshot.js'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import { evidenceCurrent } from './evidence-state.js'
import { ForgeDeskError } from './errors.js'
import { getInspectReport } from './inspect.js'
import { getReadyReport } from './ready.js'
import { loadWorkspace, pathExists, resolveSession } from './workspace.js'

type CiStatus = 'pass' | 'fail'
type FreshnessStatus = 'fresh' | 'stale' | 'missing' | 'skipped-clean-worktree'

export type CiCheckOptions = {
  sessionId?: string
}

export type CiCheckReport = {
  schemaVersion: 'forgedesk-ci-check-v1'
  generatedAt: string
  status: CiStatus
  repoPath: string
  session: {
    id: string
    title: string
    status: string
  }
  evidenceDir?: string
  ready: boolean
  inspectOk: boolean
  freshness: FreshnessStatus
  blockers: string[]
  warnings: string[]
  commands: string[]
}

export type CiInitReport = {
  schemaVersion: 'forgedesk-ci-init-v1'
  generatedAt: string
  repoPath: string
  path: string
  wrote: boolean
  next: string[]
  warnings: string[]
}

export type CiInitOptions = {
  force?: boolean
}

function now(): string {
  return new Date().toISOString()
}

function workflowPath(repoPath: string): string {
  return path.join(repoPath, '.github', 'workflows', 'forgedesk-evidence.yml')
}

export function renderCiWorkflow(): string {
  return [
    'name: ForgeDesk Evidence Gate',
    '',
    'on:',
    '  pull_request:',
    '  push:',
    '    branches:',
    '      - main',
    '',
    'jobs:',
    '  forgedesk-evidence:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v4',
    '',
    '      - name: Setup Node.js',
    '        uses: actions/setup-node@v4',
    '        with:',
    '          node-version: 22',
    '',
    '      - name: Install ForgeDesk',
    '        run: npm install -g forgedesk',
    '',
    '      - name: Check ForgeDesk evidence',
    '        run: forgedesk ci check',
    ''
  ].join('\n')
}

export async function getCiCheckReport(cwd: string, options: CiCheckOptions = {}): Promise<CiCheckReport> {
  const { workspace, session } = await resolveSession(cwd, options.sessionId)
  const blockers: string[] = []
  const warnings: string[] = []

  if (!session.evidenceDir) {
    blockers.push('Session has no generated evidence. Run "forgedesk next" or "forgedesk evidence" first.')
  }

  const inspect = session.evidenceDir
    ? await getInspectReport(cwd, { sessionId: session.id, target: 'evidence' })
    : undefined
  if (inspect && !inspect.ok) {
    blockers.push(...inspect.missingFiles.map((file) => `Evidence file is missing: ${file}.`))
  }

  const ready = await getReadyReport(cwd, session.id)
  blockers.push(...ready.blockers)
  warnings.push(...ready.warnings)

  let freshness: FreshnessStatus = session.evidenceDir ? 'skipped-clean-worktree' : 'missing'
  if (session.evidenceDir) {
    const snapshot = captureGitSnapshot(workspace.repoPath)
    if (snapshot.isDirty) {
      const fresh = await evidenceCurrent(workspace.repoPath, session, snapshot)
      freshness = fresh ? 'fresh' : 'stale'
      if (!fresh) {
        blockers.push('Evidence is stale for the current local diff. Run "forgedesk next" to refresh it.')
      }
    } else {
      warnings.push('Worktree is clean; CI check skipped local diff freshness comparison.')
    }
  }

  const uniqueBlockers = [...new Set(blockers)]
  const uniqueWarnings = [...new Set(warnings)]
  const status: CiStatus = ready.ready && inspect?.ok === true && freshness !== 'stale' ? 'pass' : 'fail'

  return {
    schemaVersion: 'forgedesk-ci-check-v1',
    generatedAt: now(),
    status,
    repoPath: workspace.repoPath,
    session: {
      id: session.id,
      title: session.title,
      status: session.status
    },
    evidenceDir: session.evidenceDir,
    ready: ready.ready,
    inspectOk: inspect?.ok === true,
    freshness,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    commands: status === 'pass'
      ? ['forgedesk inspect', 'forgedesk ready']
      : ['forgedesk doctor', 'forgedesk next', 'forgedesk ready']
  }
}

export async function initCiWorkflow(cwd: string, options: CiInitOptions = {}): Promise<CiInitReport> {
  const workspace = await loadWorkspace(cwd)
  const filePath = workflowPath(workspace.repoPath)
  if ((await pathExists(filePath)) && !options.force) {
    throw new ForgeDeskError(
      `CI workflow already exists: ${displayPath(filePath)}. Use --force to overwrite it.`
    )
  }
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, renderCiWorkflow(), 'utf8')
  return {
    schemaVersion: 'forgedesk-ci-init-v1',
    generatedAt: now(),
    repoPath: workspace.repoPath,
    path: filePath,
    wrote: true,
    next: ['Review the workflow file, then commit it if this repository should enforce ForgeDesk evidence in CI.'],
    warnings: ['The generated workflow installs ForgeDesk from npm. Use a published ForgeDesk version that includes "ci check".']
  }
}

export function renderCiCheckReport(report: CiCheckReport): string {
  return [
    'ForgeDesk CI Check',
    '',
    `Status: ${report.status}`,
    `Ready: ${report.ready ? 'yes' : 'no'}`,
    `Inspect OK: ${report.inspectOk ? 'yes' : 'no'}`,
    `Freshness: ${report.freshness}`,
    `Repo: ${displayPath(report.repoPath)}`,
    `Session: ${report.session.title}`,
    `Session ID: ${report.session.id}`,
    report.evidenceDir ? `Evidence: ${displayPath(report.evidenceDir)}` : undefined,
    '',
    '## Blockers',
    ...listLinesOrNone(report.blockers),
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings),
    '',
    '## Commands',
    ...listLinesOrNone(report.commands),
    '',
    'CI evidence gate checks local ForgeDesk evidence. It does not call AI, upload repository contents, review code, edit code, commit, push, open PRs, tag, release, or publish.'
  ].filter((line): line is string => line !== undefined).join('\n')
}

export function renderCiInitReport(report: CiInitReport): string {
  return [
    'ForgeDesk CI Init',
    '',
    `Wrote: ${report.wrote ? 'yes' : 'no'}`,
    `Repo: ${displayPath(report.repoPath)}`,
    `Path: ${displayPath(report.path)}`,
    '',
    '## Warnings',
    ...listLinesOrNone(report.warnings),
    '',
    '## Next',
    ...listLinesOrNone(report.next)
  ].join('\n')
}
