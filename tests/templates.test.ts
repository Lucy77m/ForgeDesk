import { describe, expect, it } from 'vitest'
import { renderPrEvidence } from '../src/templates/pr-evidence.js'
import type { EvidenceBundle } from '../src/types.js'

function bundle(): EvidenceBundle {
  const now = '2026-06-10T00:00:00.000Z'
  return {
    schemaVersion: 'forgedesk-evidence-v1',
    generatedAt: now,
    project: {
      schemaVersion: 'forgedesk-project-v1',
      name: 'demo',
      repoPath: '/tmp/demo',
      createdAt: now,
      updatedAt: now
    },
    session: {
      schemaVersion: 'forgedesk-session-v1',
      id: 'session-1',
      title: 'Demo change',
      status: 'active',
      decisions: [],
      risks: [],
      tests: [],
      createdAt: now,
      updatedAt: now
    },
    gitSnapshot: {
      branch: 'main',
      head: 'abc123',
      isDirty: false,
      modifiedFiles: [],
      addedFiles: [],
      deletedFiles: [],
      untrackedFiles: [],
      recentCommits: [],
      capturedAt: now
    }
  }
}

describe('templates', () => {
  it('renders missing intent, tests, and risks without crashing', () => {
    const rendered = renderPrEvidence(bundle())

    expect(rendered).toContain('Not recorded.')
    expect(rendered).toContain('No tests recorded.')
    expect(rendered).toContain('# PR Evidence')
  })
})
