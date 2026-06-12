import type { EvidenceBundle } from '../types.js'
import { listOrNone, renderTestGroup } from './format.js'

export function renderTestEvidence(bundle: EvidenceBundle): string {
  const tests = bundle.session.tests
  const autoChecks = bundle.autoCapture?.checks ?? []

  return `# Test Evidence

## Commands

${listOrNone(tests.length > 0 ? tests.map((test) => test.command) : autoChecks.map((check) => `${check.command} (${check.source})`), 'No command tests recorded.')}

## Results

${tests.length > 0 ? renderTestGroup(tests) : listOrNone(autoChecks.map((check) => `${check.command}: ${check.status}`), 'No command tests recorded.')}

## Manual Checks

${listOrNone((bundle.session.manualChecks ?? []).map((check) => check.text))}

This file records local test evidence. It does not prove code correctness.
`
}
