import type { EvidenceBundle } from '../types.js'
import {
  executedTests,
  listOrNone,
  notVerified,
  recordedOnlyTests,
  renderChangedFiles,
  renderTestGroup
} from './format.js'

export function renderPrEvidence(bundle: EvidenceBundle): string {
  const { session, gitSnapshot } = bundle

  return `# PR Evidence

## Change

${session.title}

## Intent

${session.intent || 'Not recorded.'}

## Git Summary

- Branch: ${gitSnapshot.branch}
- HEAD: ${gitSnapshot.head}
- Dirty: ${gitSnapshot.isDirty ? 'yes' : 'no'}
- Changed files: ${
    gitSnapshot.modifiedFiles.length +
    gitSnapshot.addedFiles.length +
    gitSnapshot.deletedFiles.length +
    gitSnapshot.untrackedFiles.length
  }

## Files Changed

${renderChangedFiles(gitSnapshot)}

## Decisions

${listOrNone(session.decisions.map((decision) => decision.text))}

## Risks / Review Focus

${listOrNone(session.risks.map((risk) => `${risk.severity ? `[${risk.severity}] ` : ''}${risk.text}`))}

## Tests

### Executed Tests

${renderTestGroup(executedTests(session.tests))}

### Recorded Only

${renderTestGroup(recordedOnlyTests(session.tests))}

## Not Verified

${listOrNone(notVerified(session))}

## Suggested PR Description

${session.intent || session.title}
`
}
