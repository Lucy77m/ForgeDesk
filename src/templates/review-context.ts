import type { EvidenceBundle } from '../types.js'
import { listOrNone, renderChangedFiles, testSummary } from './format.js'

export function renderReviewContext(bundle: EvidenceBundle): string {
  const riskHints = bundle.autoCapture?.riskHints ?? []

  return `# Review Context

## Change Intent

${bundle.session.intent || bundle.session.title}

## Changed Files

${renderChangedFiles(bundle.gitSnapshot)}

## Risk Hints

${listOrNone(riskHints.map((hint) => `${hint.text} (${hint.source}, ${hint.severity})`), 'No risk hints generated.')}

## Test Evidence

${testSummary(bundle.session)}

## Review Instructions

- Check whether the diff matches the stated intent.
- Focus on the risk hints above.
- Use tests as supporting evidence, not proof of correctness.
- Do not assume correctness based only on this context.

ForgeDesk prepares review context. It does not review or approve code.
`
}
