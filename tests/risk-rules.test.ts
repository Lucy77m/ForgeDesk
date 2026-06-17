import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { deriveRiskHints, deriveRiskHintsAsync, loadCustomRules } from '../src/core/risk-rules.js'
import type { GitSnapshot } from '../src/types.js'
import { cleanupDir, initGitRepo, tempDir } from './helpers.js'

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

  describe('custom rules', () => {
    const dirs: string[] = []

    afterEach(() => {
      for (const dir of dirs.splice(0)) {
        cleanupDir(dir)
      }
    })

    function writeRules(repo: string, rules: object): void {
      const dir = path.join(repo, '.forgedesk')
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, 'rules.json'), JSON.stringify(rules, null, 2), 'utf8')
    }

    it('returns empty when rules.json does not exist', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)

      const rules = await loadCustomRules(repo)

      expect(rules).toEqual([])
    })

    it('loads custom rules and appends to builtin hints', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      writeRules(repo, {
        schemaVersion: 'forgedesk-rules-v1',
        rules: [
          {
            name: 'internal-api',
            pattern: '(^|/)internal/api/',
            message: 'Internal API changed.',
            severity: 'high',
            confidence: 'medium'
          }
        ]
      })

      const hints = await deriveRiskHintsAsync(repo, snapshot({
        modifiedFiles: ['internal/api/service.ts']
      }))

      expect(hints.some((h) => h.source === 'rule:internal-api')).toBe(true)
      expect(hints.some((h) => h.text === 'Internal API changed.')).toBe(true)
    })

    it('custom rules override builtin rules with the same name', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      writeRules(repo, {
        schemaVersion: 'forgedesk-rules-v1',
        rules: [
          {
            name: 'path-auth',
            pattern: '(^|/)auth/',
            message: 'Custom auth warning.',
            severity: 'high',
            confidence: 'high'
          }
        ]
      })

      const hints = await deriveRiskHintsAsync(repo, snapshot({
        modifiedFiles: ['auth/login.ts']
      }))

      const authHint = hints.find((h) => h.source === 'rule:path-auth')
      expect(authHint).toBeDefined()
      expect(authHint!.text).toBe('Custom auth warning.')
      expect(authHint!.severity).toBe('high')
    })

    it('skips disabled rules', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      writeRules(repo, {
        schemaVersion: 'forgedesk-rules-v1',
        rules: [
          {
            name: 'disabled-rule',
            pattern: '(^|/)disabled/',
            message: 'Should not appear.',
            severity: 'low',
            confidence: 'low',
            enabled: false
          }
        ]
      })

      const rules = await loadCustomRules(repo)

      expect(rules).toEqual([])
    })

    it('silently falls back when rules.json is invalid JSON', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      const dir = path.join(repo, '.forgedesk')
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, 'rules.json'), '{ invalid json', 'utf8')

      const rules = await loadCustomRules(repo)

      expect(rules).toEqual([])
    })

    it('silently falls back when schemaVersion does not match', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      writeRules(repo, {
        schemaVersion: 'forgedesk-rules-v0',
        rules: [
          {
            name: 'test',
            pattern: 'test',
            message: 'Test.',
            severity: 'low',
            confidence: 'low'
          }
        ]
      })

      const rules = await loadCustomRules(repo)

      expect(rules).toEqual([])
    })

    it('skips rule entries with missing required fields', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      writeRules(repo, {
        schemaVersion: 'forgedesk-rules-v1',
        rules: [
          { name: 'incomplete' },
          {
            name: 'valid',
            pattern: '(^|/)valid/',
            message: 'Valid rule.',
            severity: 'medium',
            confidence: 'high'
          }
        ]
      })

      const rules = await loadCustomRules(repo)

      expect(rules).toHaveLength(1)
      expect(rules[0].name).toBe('valid')
    })

    it('builtin rules still work without rules.json', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)

      const hints = await deriveRiskHintsAsync(repo, snapshot({
        modifiedFiles: ['src/auth/login.ts']
      }))

      expect(hints.some((h) => h.source === 'rule:path-auth')).toBe(true)
    })
  })
})
