import type { EvidenceBundle } from '../types.js'
import { displayPath, executedTests, failedTests, recordedOnlyTests, renderTestGroup } from './format.js'

export function renderTestResults(bundle: EvidenceBundle): string {
  const tests = bundle.session.tests

  return `# Test Results

## Executed Tests

${renderTestGroup(executedTests(tests))}

## Recorded Only

${renderTestGroup(recordedOnlyTests(tests))}

## Failures

${failedTests(tests).length > 0 ? failedTests(tests).map((test) => `- \`${test.command}\` exited ${test.exitCode}`).join('\n') : '- None'}

## Logs

${tests.some((test) => test.logFile) ? tests.filter((test) => test.logFile).map((test) => `- ${displayPath(test.logFile!)}`).join('\n') : '- None'}

## Manual Checks

- None recorded.
`
}
