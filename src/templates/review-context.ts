import type { EvidenceBundle } from '../types.js'
import { changedFileCount, listOrNone, notVerified, renderChangedFiles, testSummary } from './format.js'

export function renderReviewContext(bundle: EvidenceBundle): string {
  const riskHints = bundle.autoCapture?.riskHints ?? []
  const gaps = notVerified(bundle.session)

  return `# Review Context

## At A Glance

- Session: ${bundle.session.title}
- Status: ${bundle.session.status}
- Branch: ${bundle.gitSnapshot.branch}
- HEAD: ${bundle.gitSnapshot.head}
- Changed files: ${changedFileCount(bundle.gitSnapshot)}

## Change Intent

${bundle.session.intent || bundle.session.title}

## Changed Files

${renderChangedFiles(bundle.gitSnapshot)}

## Risk Hints

${listOrNone(riskHints.map((hint) => `${hint.text} (${hint.source}, ${hint.severity})`), 'No risk hints generated.')}

## Test Evidence

${testSummary(bundle.session)}

## Reviewer Checklist

- Confirm the implementation matches the stated intent.
- Inspect the changed files before relying on generated summaries.
- Treat failed, missing, or recorded-only tests as blockers until addressed.
- Review risk hints and known limits explicitly.

## Known Limits

${listOrNone(gaps, 'No known gaps recorded.')}

## Review Instructions

- Check whether the diff matches the stated intent.
- Focus on the risk hints above.
- Use tests as supporting evidence, not proof of correctness.
- Do not assume correctness based only on this context.

ForgeDesk prepares review context. It does not review or approve code.
`
}
