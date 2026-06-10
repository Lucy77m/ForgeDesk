import type { ChangeSession, GitSnapshot, TestRun } from '../types.js'

type TestEvidenceCounts = {
  passed: number
  failed: number
  recorded: number
  executed: number
  manual: number
}

type ChangedFileSection = {
  heading: string
  files: string[]
}

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

function testsWithStatus(tests: TestRun[], status: TestRun['status']): TestRun[] {
  return tests.filter((test) => test.status === status)
}

export function recordedOnlyTests(tests: TestRun[]): TestRun[] {
  return testsWithStatus(tests, 'recorded')
}

export function executedTests(tests: TestRun[]): TestRun[] {
  return tests.filter((test) => test.status !== 'recorded')
}

export function failedTests(tests: TestRun[]): TestRun[] {
  return testsWithStatus(tests, 'failed')
}

export function passedTests(tests: TestRun[]): TestRun[] {
  return testsWithStatus(tests, 'passed')
}

export function changedFileCount(snapshot: GitSnapshot): number {
  return (
    snapshot.modifiedFiles.length +
    snapshot.addedFiles.length +
    snapshot.deletedFiles.length +
    snapshot.untrackedFiles.length
  )
}

function testEvidenceCounts(session: ChangeSession): TestEvidenceCounts {
  return {
    passed: passedTests(session.tests).length,
    failed: failedTests(session.tests).length,
    recorded: recordedOnlyTests(session.tests).length,
    executed: executedTests(session.tests).length,
    manual: session.manualChecks?.length ?? 0
  }
}

export function testSummary(session: ChangeSession): string {
  const counts = testEvidenceCounts(session)

  return `${counts.executed} executed (${counts.passed} passed, ${counts.failed} failed), ${counts.recorded} recorded only, ${counts.manual} manual`
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

function changedFileSections(snapshot: GitSnapshot): ChangedFileSection[] {
  return [
    { heading: 'Modified', files: snapshot.modifiedFiles },
    { heading: 'Added', files: snapshot.addedFiles },
    { heading: 'Deleted', files: snapshot.deletedFiles },
    { heading: 'Untracked', files: snapshot.untrackedFiles }
  ]
}

function renderChangedFileSection(section: ChangedFileSection): string {
  return section.files.length ? `### ${section.heading}\n${listOrNone(section.files.map(displayPath))}` : ''
}

export function renderChangedFiles(snapshot: GitSnapshot): string {
  return changedFileSections(snapshot)
    .map(renderChangedFileSection)
    .filter(Boolean)
    .join('\n\n') || '- None'
}

function hasNoTestEvidence(session: ChangeSession): boolean {
  return session.tests.length === 0 && (session.manualChecks?.length ?? 0) === 0
}

function hasNoCommandTests(session: ChangeSession): boolean {
  return session.tests.length === 0
}

function hasFailedTest(session: ChangeSession): boolean {
  return session.tests.some((test) => test.status === 'failed')
}

function hasOnlyRecordedTests(session: ChangeSession): boolean {
  return session.tests.length > 0 && session.tests.every((test) => test.status === 'recorded')
}

export function notVerified(session: ChangeSession): string[] {
  const gaps: string[] = []
  if (!session.intent) {
    gaps.push('Intent is missing.')
  }
  if (hasNoTestEvidence(session)) {
    gaps.push('No test evidence recorded.')
  } else if (hasNoCommandTests(session)) {
    gaps.push('No command tests recorded.')
  }
  if (hasFailedTest(session)) {
    gaps.push('At least one test command failed.')
  }
  if (hasOnlyRecordedTests(session)) {
    gaps.push('Tests were recorded but not run by ForgeDesk.')
  }
  if (session.risks.length > 0) {
    gaps.push('Recorded risks need review before merge or release.')
  }
  return gaps
}
