import type { EvidenceBundle, RiskHint } from '../types.js'
import { changedFileCount, displayPath, listOrNone, testSummary } from './format.js'

function riskLines(riskHints: RiskHint[]): string[] {
  return riskHints.map((hint) => `${hint.text} (${hint.source}, ${hint.confidence})`)
}

function checkLines(bundle: EvidenceBundle): string {
  const checks = bundle.autoCapture?.checks ?? []
  return checks.length > 0
    ? listOrNone(checks.map((check) => `${check.command}: ${check.status} (${check.source})`))
    : testSummary(bundle.session)
}

export function renderSummary(bundle: EvidenceBundle): string {
  const riskHints = bundle.autoCapture?.riskHints ?? []

  return `# ForgeDesk Summary

## Status

${bundle.session.status}

## Change

${bundle.session.intent || bundle.session.title}

## Files

- Changed files: ${changedFileCount(bundle.gitSnapshot)}
- Branch: ${bundle.gitSnapshot.branch}
- HEAD: ${bundle.gitSnapshot.head}

## Checks

${checkLines(bundle)}

## Risk Hints

${listOrNone(riskLines(riskHints), 'No risk hints generated.')}

## Review Focus

${listOrNone(riskHints.map((hint) => hint.text), 'Review the diff and recorded tests.')}

## Generated Artifacts

- SUMMARY.md
- PR_BODY.md
- REVIEW_CONTEXT.md
- TEST_EVIDENCE.md
- PR_EVIDENCE.md
- evidence.json

This summary prepares review context. It is not a code review verdict.
`
}
