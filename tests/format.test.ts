import { describe, expect, it } from 'vitest'
import {
  changedFileCount,
  compactText,
  displayPath,
  executedTests,
  failedTests,
  listLinesOrNone,
  notVerified,
  passedTests,
  recordedOnlyTests,
  renderChangedFiles,
  reviewReadiness,
  testSummary
} from '../src/templates/format.js'
import type { ChangeSession, GitSnapshot, TestRun } from '../src/types.js'

const now = '2026-06-11T00:00:00.000Z'

function session(overrides: Partial<ChangeSession> = {}): ChangeSession {
  return {
    schemaVersion: 'forgedesk-session-v1',
    id: 'session-1',
    title: 'Demo change',
    status: 'active',
    decisions: [],
    risks: [],
    tests: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

function testRun(id: string, status: TestRun['status']): TestRun {
  return {
    id,
    command: `pnpm ${id}`,
    status
  }
}

describe('format helpers', () => {
  it('normalizes display paths', () => {
    expect(displayPath('docs\\commands.md')).toBe('docs/commands.md')
    expect(displayPath('src/core/workspace.ts')).toBe('src/core/workspace.ts')
  })

  it('renders list items as reusable output lines', () => {
    expect(listLinesOrNone(['alpha', 'beta'])).toEqual(['- alpha', '- beta'])
    expect(listLinesOrNone([], 'No items.')).toEqual(['- No items.'])
  })

  it('counts changed files across git status groups', () => {
    const snapshot: GitSnapshot = {
      branch: 'main',
      head: 'abc123',
      isDirty: true,
      modifiedFiles: ['README.md', 'docs/commands.md'],
      addedFiles: ['src/new.ts'],
      deletedFiles: ['old.txt'],
      untrackedFiles: ['notes.md', 'tmp.txt'],
      recentCommits: [],
      capturedAt: now
    }

    expect(changedFileCount(snapshot)).toBe(6)
  })

  it('renders changed file groups in status order', () => {
    const snapshot: GitSnapshot = {
      branch: 'main',
      head: 'abc123',
      isDirty: true,
      modifiedFiles: ['src\\core\\workspace.ts'],
      addedFiles: ['tests/format.test.ts'],
      deletedFiles: ['old\\removed.ts'],
      untrackedFiles: ['notes.md'],
      recentCommits: [],
      capturedAt: now
    }

    expect(renderChangedFiles(snapshot)).toBe(
      [
        '### Modified',
        '- src/core/workspace.ts',
        '',
        '### Added',
        '- tests/format.test.ts',
        '',
        '### Deleted',
        '- old/removed.ts',
        '',
        '### Untracked',
        '- notes.md'
      ].join('\n')
    )
    expect(renderChangedFiles({ ...snapshot, modifiedFiles: [], addedFiles: [], deletedFiles: [], untrackedFiles: [] }))
      .toBe('- None')
  })

  it('groups tests by recorded, executed, failed, and passed status', () => {
    const tests = [testRun('recorded', 'recorded'), testRun('passed', 'passed'), testRun('failed', 'failed')]

    expect(recordedOnlyTests(tests).map((test) => test.id)).toEqual(['recorded'])
    expect(executedTests(tests).map((test) => test.id)).toEqual(['passed', 'failed'])
    expect(failedTests(tests).map((test) => test.id)).toEqual(['failed'])
    expect(passedTests(tests).map((test) => test.id)).toEqual(['passed'])
  })

  it('summarizes command and manual test evidence', () => {
    const value = session({
      tests: [testRun('passed', 'passed'), testRun('failed', 'failed'), testRun('recorded', 'recorded')],
      manualChecks: [
        {
          id: 'check-1',
          text: 'Opened generated evidence.',
          createdAt: now
        },
        {
          id: 'check-2',
          text: 'Reviewed ready output.',
          createdAt: now
        }
      ]
    })

    expect(testSummary(value)).toBe('2 executed (1 passed, 1 failed), 1 recorded only, 2 manual')
  })

  it('reports readiness lines and verification gaps', () => {
    const value = session({
      intent: 'Ship focused tests.',
      tests: [testRun('passed', 'passed')],
      decisions: [
        {
          id: 'decision-1',
          text: 'Use direct unit tests.',
          createdAt: now
        }
      ]
    })

    expect(reviewReadiness(value)).toEqual([
      'Intent: present',
      'Tests: 1 executed (1 passed, 0 failed), 0 recorded only, 0 manual',
      'Decisions: 1',
      'Risks: 0',
      'Known gaps: none recorded'
    ])
    expect(notVerified(value)).toEqual([])
  })

  it('detects missing, manual-only, failed, recorded-only, and risk gaps', () => {
    expect(notVerified(session())).toEqual(['Intent is missing.', 'No test evidence recorded.'])

    expect(
      notVerified(
        session({
          intent: 'Manual-only check.',
          manualChecks: [
            {
              id: 'check-1',
              text: 'Opened the output.',
              createdAt: now
            }
          ]
        })
      )
    ).toEqual(['No command tests recorded.'])

    expect(
      notVerified(
        session({
          intent: 'Failed command.',
          tests: [testRun('failed', 'failed')]
        })
      )
    ).toContain('At least one test command failed.')

    expect(
      notVerified(
        session({
          intent: 'Recorded-only command.',
          risks: [
            {
              id: 'risk-1',
              text: 'Needs reviewer attention.',
              createdAt: now
            }
          ],
          tests: [testRun('recorded', 'recorded')]
        })
      )
    ).toEqual(['Tests were recorded but not run by ForgeDesk.', 'Recorded risks need review before merge or release.'])
  })

  it('compacts whitespace and truncates long text', () => {
    expect(compactText('  alpha\n\n beta\tgamma  ')).toBe('alpha beta gamma')
    expect(compactText('abcdefghijklmnopqrstuvwxyz', 20)).toBe('abcde ... [truncated]')
  })
})
