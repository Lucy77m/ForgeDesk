import type { EvidenceBundle } from '../types.js'
import { displayPath, listOrNone, testSummary } from './format.js'

export function renderChangeSummary(bundle: EvidenceBundle): string {
  const { session, gitSnapshot } = bundle
  const mainFiles = [
    ...gitSnapshot.modifiedFiles,
    ...gitSnapshot.addedFiles,
    ...gitSnapshot.deletedFiles,
    ...gitSnapshot.untrackedFiles
  ]

  return `# Change Summary

## What Changed

${session.title}

## Why It Changed

${session.intent || 'Not recorded.'}

## Main Files

${listOrNone(mainFiles.map(displayPath))}

## Behavior Impact

Not recorded.

## Compatibility Notes

Not recorded.

## Test Evidence

${testSummary(session)}
`
}
