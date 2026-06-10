import type { EvidenceBundle } from '../types.js'
import { renderTest } from './format.js'

export function renderTestResults(bundle: EvidenceBundle): string {
  const tests = bundle.session.tests

  return `# Test Results

## Commands

${tests.length > 0 ? tests.map(renderTest).join('\n') : '- None'}

## Results

${tests.length > 0 ? tests.map((test) => `- ${test.status}: \`${test.command}\``).join('\n') : '- None'}

## Failures

${tests.some((test) => test.status === 'failed') ? tests.filter((test) => test.status === 'failed').map((test) => `- \`${test.command}\` exited ${test.exitCode}`).join('\n') : '- None'}

## Logs

${tests.some((test) => test.logFile) ? tests.filter((test) => test.logFile).map((test) => `- ${test.logFile}`).join('\n') : '- None'}

## Manual Checks

- None recorded.
`
}
