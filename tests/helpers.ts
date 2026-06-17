import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EVIDENCE_FILE_NAMES } from '../src/core/constants.js'
import { pathsFor, sessionFile } from '../src/core/workspace.js'
import {
  CONFIG_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  SESSION_SCHEMA_VERSION,
  type ChangeSession,
  type Decision,
  type ManualCheck,
  type Risk,
  type TestRun
} from '../src/types.js'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function tempDir(prefix = 'forgedesk-'): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function cleanupDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

export function git(repoPath: string, args: string[]): void {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    windowsHide: true
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout)
  }
}

export function initGitRepo(repoPath: string): void {
  mkdirSync(repoPath, { recursive: true })
  git(repoPath, ['init'])
  git(repoPath, ['config', 'user.email', 'forgedesk@example.test'])
  git(repoPath, ['config', 'user.name', 'ForgeDesk Test'])
  writeFileSync(path.join(repoPath, 'README.md'), '# Demo\n', 'utf8')
  writeFileSync(path.join(repoPath, 'delete-me.txt'), 'delete me\n', 'utf8')
  git(repoPath, ['add', '.'])
  git(repoPath, ['commit', '-m', 'initial commit'])
}

export function initEmptyGitRepo(repoPath: string): void {
  mkdirSync(repoPath, { recursive: true })
  git(repoPath, ['init'])
  git(repoPath, ['config', 'user.email', 'forgedesk@example.test'])
  git(repoPath, ['config', 'user.name', 'ForgeDesk Test'])
}

export function runCli(repoPath: string, args: string[]) {
  const cliPath = path.join(projectRoot, 'src', 'cli', 'index.ts')
  const tsxLoader = pathToFileURL(path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href
  return spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
    cwd: repoPath,
    encoding: 'utf8',
    windowsHide: true
  })
}

const testNow = '2026-06-17T00:00:00.000Z'

export type CreateSessionOptions = {
  sessionId?: string
  title?: string
  status?: ChangeSession['status']
  intent?: string
  tests?: TestRun[]
  decisions?: Decision[]
  risks?: Risk[]
  manualChecks?: ManualCheck[]
  skipEvidenceFiles?: boolean
}

export function createSessionWithEvidence(repo: string, options: CreateSessionOptions = {}): string {
  const sessionId = options.sessionId ?? 'test-session-001'
  const title = options.title ?? 'Test session'
  const status = options.status ?? 'needs-review'
  const paths = pathsFor(repo)

  mkdirSync(paths.sessionsDir, { recursive: true })
  mkdirSync(paths.evidenceDir, { recursive: true })
  mkdirSync(paths.exportsDir, { recursive: true })
  mkdirSync(paths.logsDir, { recursive: true })

  writeFileSync(
    paths.projectFile,
    `${JSON.stringify(
      {
        schemaVersion: PROJECT_SCHEMA_VERSION,
        name: 'test-project',
        repoPath: repo,
        createdAt: testNow,
        updatedAt: testNow
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  writeFileSync(
    paths.configFile,
    `${JSON.stringify(
      {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        activeSessionId: sessionId,
        createdAt: testNow,
        updatedAt: testNow
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  const evidenceDir = path.join(paths.evidenceDir, sessionId)
  mkdirSync(evidenceDir, { recursive: true })

  const session: Record<string, unknown> = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: sessionId,
    title,
    status,
    decisions: options.decisions ?? [],
    risks: options.risks ?? [],
    tests: options.tests ?? [],
    createdAt: testNow,
    updatedAt: testNow
  }

  if (options.intent) {
    session.intent = options.intent
  }
  if (options.manualChecks) {
    session.manualChecks = options.manualChecks
  }

  session.evidenceDir = path.relative(repo, evidenceDir)
  session.gitSnapshot = {
    branch: 'main',
    head: 'abc1234',
    isDirty: false,
    modifiedFiles: [],
    addedFiles: [],
    deletedFiles: [],
    untrackedFiles: [],
    recentCommits: [{ hash: 'abc1234', message: 'test commit' }],
    capturedAt: testNow
  }

  writeFileSync(sessionFile(repo, sessionId), `${JSON.stringify(session, null, 2)}\n`, 'utf8')

  if (!options.skipEvidenceFiles) {
    for (const file of EVIDENCE_FILE_NAMES) {
      writeFileSync(path.join(evidenceDir, file), `# ${file}\n`, 'utf8')
    }
  }

  return sessionId
}

export function assertEvidenceFiles(dir: string): void {
  for (const file of EVIDENCE_FILE_NAMES) {
    const filePath = path.join(dir, file)
    if (!existsSync(filePath)) {
      throw new Error(`Expected evidence file missing: ${file} at ${filePath}`)
    }
  }
}

export function simulateDirtyWorkspace(repo: string, files: Record<string, string>): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(repo, relativePath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, content, 'utf8')
  }
}
