import type { ChangeSession, GitSnapshot, TestRun } from '../types.js'

export function listOrNone(items: string[], emptyText = 'None'): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${emptyText}`
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
    lines.push(`  - summary: ${compactText(test.summary)}`)
  }
  return lines.join('\n')
}

export function compactText(value: string, maxLength = 700): string {
  const compacted = value.replace(/\s+/g, ' ').trim()
  if (compacted.length <= maxLength) {
    return compacted
  }

  return `${compacted.slice(0, maxLength - 15)} ... [truncated]`
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

export function passedTests(tests: TestRun[]): TestRun[] {
  return tests.filter((test) => test.status === 'passed')
}

export function changedFileCount(snapshot: GitSnapshot): number {
  return (
    snapshot.modifiedFiles.length +
    snapshot.addedFiles.length +
    snapshot.deletedFiles.length +
    snapshot.untrackedFiles.length
  )
}

export function testSummary(session: ChangeSession): string {
  const passed = passedTests(session.tests).length
  const failed = failedTests(session.tests).length
  const recorded = recordedOnlyTests(session.tests).length
  const executed = executedTests(session.tests).length

  const manual = session.manualChecks?.length ?? 0

  return `${executed} executed (${passed} passed, ${failed} failed), ${recorded} recorded only, ${manual} manual`
}

export function reviewReadiness(session: ChangeSession): string[] {
  const gaps = notVerified(session)

  return [
    `Intent: ${session.intent ? 'present' : 'missing'}`,
    `Tests: ${testSummary(session)}`,
    `Decisions: ${session.decisions.length}`,
    `Risks: ${session.risks.length}`,
    `Known gaps: ${gaps.length > 0 ? gaps.length : 'none recorded'}`
  ]
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
  if (session.tests.length === 0 && (session.manualChecks?.length ?? 0) === 0) {
    gaps.push('No test evidence recorded.')
  } else if (session.tests.length === 0) {
    gaps.push('No command tests recorded.')
  }
  if (session.tests.some((test) => test.status === 'failed')) {
    gaps.push('At least one test command failed.')
  }
  if (session.tests.length > 0 && session.tests.every((test) => test.status === 'recorded')) {
    gaps.push('Tests were recorded but not run by ForgeDesk.')
  }
  if (session.risks.length > 0) {
    gaps.push('Recorded risks need review before merge or release.')
  }
  return gaps
}
