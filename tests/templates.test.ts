import { describe, expect, it } from 'vitest'
import { renderPrEvidence } from '../src/templates/pr-evidence.js'
import { renderTestResults } from '../src/templates/test-results.js'
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
    expect(rendered).toContain('No test evidence recorded.')
    expect(rendered).toContain('## Review Readiness')
    expect(rendered).toContain('- Intent: missing')
    expect(rendered).toContain('# PR Evidence')
  })

  it('groups recorded and executed tests and normalizes log paths', () => {
    const value = bundle()
    value.session.tests = [
      {
        id: 'test-1',
        command: 'pnpm test',
        status: 'recorded'
      },
      {
        id: 'test-2',
        command: 'pnpm test',
        status: 'passed',
        exitCode: 0,
        logFile: '.forgedesk\\logs\\test-2.log'
      }
    ]

    const rendered = renderTestResults(value)

    expect(rendered).toContain('## Executed Tests')
    expect(rendered).toContain('## Recorded Only')
    expect(rendered).toContain('.forgedesk/logs/test-2.log')
    expect(rendered).not.toContain('.forgedesk\\logs')
  })

  it('renders a clean no-gap readiness state when evidence is complete', () => {
    const value = bundle()
    value.session.intent = 'Ship a focused documentation update.'
    value.session.tests = [
      {
        id: 'test-1',
        command: 'pnpm test',
        status: 'passed',
        exitCode: 0,
        summary: `${'ok '.repeat(400)}done`
      }
    ]
    value.gitSnapshot.modifiedFiles = ['docs\\guide.md']

    const rendered = renderPrEvidence(value)

    expect(rendered).toContain('- Intent: present')
    expect(rendered).toContain('- Tests: 1 executed (1 passed, 0 failed), 0 recorded only, 0 manual')
    expect(rendered).toContain('- No known gaps recorded.')
    expect(rendered).toContain('- docs/guide.md')
    expect(rendered).toContain('[truncated]')
  })

  it('renders manual checks in evidence', () => {
    const value = bundle()
    value.session.intent = 'Document manual verification.'
    value.session.manualChecks = [
      {
        id: 'check-1',
        text: 'Opened the generated PR evidence and verified the review readiness section.',
        createdAt: '2026-06-10T00:00:00.000Z'
      }
    ]

    const rendered = renderPrEvidence(value)

    expect(rendered).toContain('### Manual Checks')
    expect(rendered).toContain('Opened the generated PR evidence')
    expect(rendered).toContain('No command tests recorded.')
    expect(rendered).not.toContain('Tests were recorded but not run by ForgeDesk.')
  })
})
