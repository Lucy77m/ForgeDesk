import type { ChangeSession, GitSnapshot, TestRun } from '../types.js'

export function listOrNone(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- None'
}

export function displayPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

export function renderTest(test: TestRun): string {
  const lines = [`- \`${test.command}\` - ${test.status}`]
  if (typeof test.exitCode === 'number') {
    lines.push(`  - exit code: ${test.exitCode}`)
  }
  if (test.logFile) {
    lines.push(`  - log: ${displayPath(test.logFile)}`)
  }
  if (test.summary) {
    lines.push(`  - summary: ${test.summary.replace(/\r?\n/g, ' ')}`)
  }
  return lines.join('\n')
}

export function renderTestGroup(tests: TestRun[]): string {
  return tests.length > 0 ? tests.map(renderTest).join('\n') : '- None'
}

export function recordedOnlyTests(tests: TestRun[]): TestRun[] {
  return tests.filter((test) => test.status === 'recorded')
}

export function executedTests(tests: TestRun[]): TestRun[] {
  return tests.filter((test) => test.status !== 'recorded')
}

export function failedTests(tests: TestRun[]): TestRun[] {
  return tests.filter((test) => test.status === 'failed')
}

export function renderChangedFiles(snapshot: GitSnapshot): string {
  return [
    snapshot.modifiedFiles.length ? `### Modified\n${listOrNone(snapshot.modifiedFiles.map(displayPath))}` : '',
    snapshot.addedFiles.length ? `### Added\n${listOrNone(snapshot.addedFiles.map(displayPath))}` : '',
    snapshot.deletedFiles.length ? `### Deleted\n${listOrNone(snapshot.deletedFiles.map(displayPath))}` : '',
    snapshot.untrackedFiles.length ? `### Untracked\n${listOrNone(snapshot.untrackedFiles.map(displayPath))}` : ''
  ]
    .filter(Boolean)
    .join('\n\n') || '- None'
}

export function notVerified(session: ChangeSession): string[] {
  const gaps: string[] = []
  if (!session.intent) {
    gaps.push('Intent is missing.')
  }
  if (session.tests.length === 0) {
    gaps.push('No tests recorded.')
  }
  if (session.tests.some((test) => test.status === 'failed')) {
    gaps.push('At least one test command failed.')
  }
  if (session.tests.every((test) => test.status === 'recorded')) {
    gaps.push('Tests were recorded but not run by ForgeDesk.')
  }
  if (session.risks.length > 0) {
    gaps.push('Review listed risks before merge or release.')
  }
  return gaps
}
