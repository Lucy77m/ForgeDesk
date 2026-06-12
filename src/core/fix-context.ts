import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { captureGitSnapshot } from '../git/snapshot.js'
import { displayPath, renderChangedFiles } from '../templates/format.js'
import type { ChangeSession, GitSnapshot, TestRun } from '../types.js'
import { ForgeDeskError } from './errors.js'
import { pathExists, resolveSession } from './workspace.js'

export type FixContextOptions = {
  sessionId?: string
}

export type FailedTestContext = {
  command: string
  exitCode?: number
  logFile?: string
  excerpt: string
}

export type FixContextReport = {
  schemaVersion: 'forgedesk-fix-context-v1'
  generatedAt: string
  repoPath: string
  session: {
    id: string
    title: string
    status: ChangeSession['status']
    intent?: string
  }
  gitSnapshot: GitSnapshot
  failedTests: FailedTestContext[]
}

const excerptLength = 4000

function failedTests(session: ChangeSession): TestRun[] {
  return session.tests.filter((test) => test.status === 'failed')
}

function boundedText(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= excerptLength) {
    return trimmed || '(no output captured)'
  }
  return `${trimmed.slice(0, 1800)}\n\n... output truncated ...\n\n${trimmed.slice(-1800)}`
}

async function readTestExcerpt(repoPath: string, test: TestRun): Promise<string> {
  if (test.logFile) {
    const logPath = path.resolve(repoPath, test.logFile)
    if (await pathExists(logPath)) {
      return boundedText(await readFile(logPath, 'utf8'))
    }
  }
  return boundedText(test.summary ?? '')
}

async function failedTestContext(repoPath: string, test: TestRun): Promise<FailedTestContext> {
  return {
    command: test.command,
    exitCode: test.exitCode,
    logFile: test.logFile ? displayPath(test.logFile) : undefined,
    excerpt: await readTestExcerpt(repoPath, test)
  }
}

export async function getFixContextReport(cwd: string, options: FixContextOptions = {}): Promise<FixContextReport> {
  const { workspace, session } = await resolveSession(cwd, options.sessionId)
  const failed = failedTests(session)
  if (failed.length === 0) {
    throw new ForgeDeskError('Cannot generate fix context because no failed tests are recorded. Run a failing test with "forgedesk test -- <command>" first.')
  }

  return {
    schemaVersion: 'forgedesk-fix-context-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      intent: session.intent
    },
    gitSnapshot: session.gitSnapshot ?? captureGitSnapshot(workspace.repoPath),
    failedTests: await Promise.all(failed.map((test) => failedTestContext(workspace.repoPath, test)))
  }
}

function failedTestList(tests: FailedTestContext[]): string[] {
  return tests.map((test) => {
    const exitCode = typeof test.exitCode === 'number' ? `, exit ${test.exitCode}` : ''
    return `- \`${test.command}\`${exitCode}`
  })
}

function failureDetails(tests: FailedTestContext[]): string {
  return tests.map((test, index) => {
    const logLine = test.logFile ? `\nLog: ${test.logFile}` : ''
    return `### ${index + 1}. ${test.command}${logLine}

\`\`\`\`text
${test.excerpt}
\`\`\`\``
  }).join('\n\n')
}

export function renderFixContext(report: FixContextReport): string {
  return `# Fix Context

## Session

- Title: ${report.session.title}
- Session ID: ${report.session.id}
- Status: ${report.session.status}
- Intent: ${report.session.intent ?? 'not recorded'}

## Changed Files

${renderChangedFiles(report.gitSnapshot)}

## Failed Tests

${failedTestList(report.failedTests).join('\n')}

## Failure Details

${failureDetails(report.failedTests)}

## Fix Instructions

- Use this context to diagnose the failed tests.
- Keep the fix scoped to the stated intent, changed files, and failure cause.
- Do not assume this context proves the code is correct.
- Do not commit, push, publish, release, or expand scope unless explicitly asked.

ForgeDesk packages local failure context. It does not fix or review code.
`
}
