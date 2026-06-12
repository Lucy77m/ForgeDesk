import { describe, expect, it } from 'vitest'
import { deriveRiskHints } from '../src/core/risk-rules.js'
import type { GitSnapshot } from '../src/types.js'

const now = '2026-06-12T00:00:00.000Z'

function snapshot(overrides: Partial<GitSnapshot>): GitSnapshot {
  return {
    branch: 'main',
    head: 'abc123',
    isDirty: true,
    modifiedFiles: [],
    addedFiles: [],
    deletedFiles: [],
    untrackedFiles: [],
    recentCommits: [],
    capturedAt: now,
    ...overrides
  }
}

describe('risk rules', () => {
  it('derives path-based risk hints with source and confidence', () => {
    const hints = deriveRiskHints(snapshot({
      modifiedFiles: ['src/auth/callback.ts', 'pnpm-lock.yaml', '.github/workflows/ci.yml']
    }))

    expect(hints.map((hint) => hint.source)).toEqual([
      'rule:path-auth',
      'rule:path-workflow',
      'rule:package-metadata'
    ])
    expect(hints.every((hint) => hint.confidence)).toBe(true)
    expect(hints.some((hint) => hint.text.includes('Auth-related files changed'))).toBe(true)
  })

  it('flags deleted files and large changes', () => {
    const hints = deriveRiskHints(snapshot({
      deletedFiles: ['src/old.ts'],
      modifiedFiles: Array.from({ length: 11 }, (_, index) => `src/file-${index}.ts`)
    }))

    expect(hints.map((hint) => hint.source)).toContain('rule:file-deleted')
    expect(hints.map((hint) => hint.source)).toContain('rule:large-change')
  })
})
