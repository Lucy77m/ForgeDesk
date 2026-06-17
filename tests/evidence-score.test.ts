import { rmSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { computeEvidenceScore, getEvidenceScore } from '../src/core/evidence-score.js'
import { EVIDENCE_FILE_NAMES } from '../src/core/constants.js'
import { pathsFor } from '../src/core/workspace.js'
import type { ChangeSession } from '../src/types.js'
import { SESSION_SCHEMA_VERSION } from '../src/types.js'
import { cleanupDir, createSessionWithEvidence, initGitRepo, tempDir } from './helpers.js'

const base = '2026-06-17T00:00:00.000Z'

function session(overrides: Partial<ChangeSession> = {}): ChangeSession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: 's1',
    title: 'Test',
    status: 'active',
    decisions: [],
    risks: [],
    tests: [],
    createdAt: base,
    updatedAt: base,
    ...overrides
  }
}

describe('evidence-score', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('scores 7/7 when all dimensions are satisfied', () => {
    const s = session({
      intent: 'Full score test.',
      decisions: [{ id: 'd1', text: 'Decision.', createdAt: base }],
      risks: [{ id: 'r1', text: 'Risk.', createdAt: base }],
      manualChecks: [{ id: 'mc1', text: 'Check.', createdAt: base }],
      tests: [{ id: 't1', command: 'npm test', status: 'passed', exitCode: 0 }]
    })

    const score = computeEvidenceScore(s, { evidenceFilesPresent: true, evidenceFresh: true })

    expect(score.total).toBe(7)
    expect(score.max).toBe(7)
    expect(score.percent).toBe(100)
    expect(score.dimensions.every((d) => d.score === 1)).toBe(true)
  })

  it('scores 0/7 when nothing is recorded', () => {
    const s = session()

    const score = computeEvidenceScore(s, { evidenceFilesPresent: false, evidenceFresh: false })

    expect(score.total).toBe(0)
    expect(score.percent).toBe(0)
    expect(score.dimensions.every((d) => d.score === 0)).toBe(true)
  })

  it('scores partial dimensions correctly', () => {
    const s = session({
      intent: 'Partial score.',
      tests: [{ id: 't1', command: 'npm test', status: 'passed', exitCode: 0 }]
    })

    const score = computeEvidenceScore(s, { evidenceFilesPresent: false, evidenceFresh: false })

    expect(score.total).toBe(2)
    expect(score.dimensions.find((d) => d.name === 'intent')!.score).toBe(1)
    expect(score.dimensions.find((d) => d.name === 'tests')!.score).toBe(1)
    expect(score.dimensions.find((d) => d.name === 'decisions')!.score).toBe(0)
    expect(score.dimensions.find((d) => d.name === 'evidence')!.score).toBe(0)
    expect(score.dimensions.find((d) => d.name === 'freshness')!.score).toBe(0)
  })

  it('scores evidence=0 when evidence files are missing', () => {
    const s = session({
      intent: 'Missing files.',
      tests: [{ id: 't1', command: 'npm test', status: 'passed', exitCode: 0 }]
    })

    const score = computeEvidenceScore(s, { evidenceFilesPresent: false, evidenceFresh: false })

    expect(score.dimensions.find((d) => d.name === 'evidence')!.score).toBe(0)
  })

  it('scores freshness=0 when evidence is stale', () => {
    const s = session({
      intent: 'Stale evidence.',
      tests: [{ id: 't1', command: 'npm test', status: 'passed', exitCode: 0 }]
    })

    const score = computeEvidenceScore(s, { evidenceFilesPresent: true, evidenceFresh: false })

    expect(score.dimensions.find((d) => d.name === 'evidence')!.score).toBe(1)
    expect(score.dimensions.find((d) => d.name === 'freshness')!.score).toBe(0)
  })

  it('computes full IO score from a temp repo', async () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)
    createSessionWithEvidence(repo, {
      intent: 'IO score test.',
      tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }],
      decisions: [{ id: 'd1', text: 'Keep it simple.', createdAt: base }],
      risks: [{ id: 'r1', text: 'Low risk.', severity: 'low', createdAt: base }],
      manualChecks: [{ id: 'mc1', text: 'Verified.', createdAt: base }]
    })

    const repoPath = repo
    const s = (await import('../src/core/workspace.js')).readSession(repoPath, 'test-session-001')
    const score = await getEvidenceScore(repoPath, await s)

    expect(score.total).toBeGreaterThanOrEqual(6)
    expect(score.max).toBe(7)
    expect(score.dimensions.find((d) => d.name === 'intent')!.score).toBe(1)
    expect(score.dimensions.find((d) => d.name === 'tests')!.score).toBe(1)
    expect(score.dimensions.find((d) => d.name === 'evidence')!.score).toBe(1)
  })

  it('scores evidence=0 and freshness=0 when evidenceDir is absent', () => {
    const s = session({
      intent: 'No evidence dir.',
      tests: [{ id: 't1', command: 'npm test', status: 'passed', exitCode: 0 }]
    })
    delete (s as any).evidenceDir

    const score = computeEvidenceScore(s, { evidenceFilesPresent: false, evidenceFresh: false })

    expect(score.dimensions.find((d) => d.name === 'evidence')!.score).toBe(0)
    expect(score.dimensions.find((d) => d.name === 'freshness')!.score).toBe(0)
  })
})
