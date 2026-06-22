import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderChangeSummary } from '../src/templates/change-summary.js'
import { renderPrBody } from '../src/templates/pr-body.js'
import { renderPrEvidence } from '../src/templates/pr-evidence.js'
import { renderReviewContext } from '../src/templates/review-context.js'
import { renderReviewPrompt } from '../src/templates/review-prompt.js'
import { renderSummary } from '../src/templates/summary.js'
import { renderTestEvidence } from '../src/templates/test-evidence.js'
import { renderTestResults } from '../src/templates/test-results.js'
import type { EvidenceBundle } from '../src/types.js'
import { buildTemplateVars, getTemplatesReport, initTemplates, loadCustomTemplate, renderTemplate } from '../src/core/templates.js'
import { cleanupDir, createSessionWithEvidence, initGitRepo, runCli, tempDir } from './helpers.js'

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

  it('renders a change summary with normalized files and test totals', () => {
    const value = bundle()
    value.session.intent = 'Summarize a local evidence change.'
    value.session.tests = [
      {
        id: 'test-1',
        command: 'pnpm test',
        status: 'passed',
        exitCode: 0
      }
    ]
    value.gitSnapshot.modifiedFiles = ['src\\core\\workspace.ts']
    value.gitSnapshot.untrackedFiles = ['tests/format.test.ts']

    const rendered = renderChangeSummary(value)

    expect(rendered).toContain('# Change Summary')
    expect(rendered).toContain('Demo change')
    expect(rendered).toContain('Summarize a local evidence change.')
    expect(rendered).toContain('- src/core/workspace.ts')
    expect(rendered).toContain('- tests/format.test.ts')
    expect(rendered).toContain('1 executed (1 passed, 0 failed), 0 recorded only, 0 manual')
  })

  it('renders a review prompt with readiness and not-verified sections', () => {
    const value = bundle()
    value.session.intent = 'Review a complete evidence pack.'
    value.session.tests = [
      {
        id: 'test-1',
        command: 'pnpm test',
        status: 'passed',
        exitCode: 0
      }
    ]
    value.gitSnapshot.addedFiles = ['docs\\reviewer-guide.md']

    const rendered = renderReviewPrompt(value)

    expect(rendered).toContain('# Review Prompt')
    expect(rendered).toContain('- Branch: main')
    expect(rendered).toContain('- Changed files: 1')
    expect(rendered).toContain('## Review Readiness')
    expect(rendered).toContain('- Intent: present')
    expect(rendered).toContain('- docs/reviewer-guide.md')
    expect(rendered).toContain('## Not Verified')
    expect(rendered).toContain('- No known gaps recorded.')
  })

  it('renders auto-capture entrypoint templates with risk hints', () => {
    const value = bundle()
    value.session.intent = 'Prepare review context for auth changes.'
    value.gitSnapshot.modifiedFiles = ['src\\auth\\callback.ts']
    value.autoCapture = {
      riskHints: [
        {
          text: 'Auth-related files changed. Review session handling, tokens, and redirect validation.',
          source: 'rule:path-auth',
          severity: 'medium',
          confidence: 'high'
        }
      ],
      checks: [
        {
          command: 'pnpm test',
          status: 'not-run',
          source: 'auto:no-run'
        }
      ],
      artifacts: {
        summary: 'SUMMARY.md',
        prBody: 'PR_BODY.md',
        reviewContext: 'REVIEW_CONTEXT.md',
        testEvidence: 'TEST_EVIDENCE.md',
        rawEvidence: 'PR_EVIDENCE.md'
      }
    }

    expect(renderSummary(value)).toContain('# ForgeDesk Summary')
    expect(renderSummary(value)).toContain('Auth-related files changed')
    expect(renderPrBody(value)).toContain('## Risks / Review Focus')
    expect(renderPrBody(value)).toContain('## Reviewer Checklist')
    expect(renderPrBody(value)).toContain('## Known Limits')
    expect(renderPrBody(value)).toContain('Generated by ForgeDesk from local git changes')
    expect(renderReviewContext(value)).toContain('# Review Context')
    expect(renderReviewContext(value)).toContain('## At A Glance')
    expect(renderReviewContext(value)).toContain('## Reviewer Checklist')
    expect(renderReviewContext(value)).toContain('## Known Limits')
    expect(renderReviewContext(value)).toContain('Do not assume correctness')
    expect(renderTestEvidence(value)).toContain('# Test Evidence')
    expect(renderTestEvidence(value)).toContain('pnpm test: not-run')
  })

  describe('custom templates', () => {
    const dirs: string[] = []

    afterEach(() => {
      for (const dir of dirs.splice(0)) {
        cleanupDir(dir)
      }
    })

    it('renderTemplate replaces simple and nested variables', () => {
      const result = renderTemplate('{{session.title}} on {{git.branch}}', {
        'session.title': 'My Change',
        'git.branch': 'feature-x'
      })
      expect(result).toBe('My Change on feature-x')
    })

    it('renderTemplate preserves unmatched placeholders', () => {
      const result = renderTemplate('{{unknown}}', {})
      expect(result).toBe('{{unknown}}')
    })

    it('buildTemplateVars produces all expected variables', () => {
      const b = bundle()
      b.session.intent = 'Build vars test.'
      b.session.manualChecks = [{ id: 'mc1', text: 'Checked.', createdAt: '2026-06-10T00:00:00.000Z' }]
      const vars = buildTemplateVars(b)

      expect(vars['session.title']).toBe('Demo change')
      expect(vars['session.intent']).toBe('Build vars test.')
      expect(vars['git.branch']).toBe('main')
      expect(vars['manualChecks']).toContain('Checked.')
    })

    it('loadCustomTemplate returns undefined when no template exists', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      const result = await loadCustomTemplate(repo, 'PR_BODY.md')
      expect(result).toBeUndefined()
    })

    it('loadCustomTemplate reads custom template content', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      const templatesDir = path.join(repo, '.forgedesk', 'templates')
      mkdirSync(templatesDir, { recursive: true })
      writeFileSync(path.join(templatesDir, 'PR_BODY.md'), 'Custom: {{session.intent}}', 'utf8')

      const result = await loadCustomTemplate(repo, 'PR_BODY.md')
      expect(result).toBe('Custom: {{session.intent}}')
    })

    it('initTemplates generates example templates', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)

      const written = await initTemplates(repo)

      expect(written).toHaveLength(3)
      expect(existsSync(path.join(repo, '.forgedesk', 'templates', 'PR_BODY.md'))).toBe(true)
      const content = readFileSync(path.join(repo, '.forgedesk', 'templates', 'PR_BODY.md'), 'utf8')
      expect(content).toContain('{{session.intent}}')
    })

    it('initTemplates does not overwrite existing templates', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      const templatesDir = path.join(repo, '.forgedesk', 'templates')
      mkdirSync(templatesDir, { recursive: true })
      writeFileSync(path.join(templatesDir, 'PR_BODY.md'), 'My custom', 'utf8')

      const written = await initTemplates(repo)

      expect(written).toHaveLength(2)
      expect(readFileSync(path.join(templatesDir, 'PR_BODY.md'), 'utf8')).toBe('My custom')
    })

    it('custom template is used in evidence generation', async () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      createSessionWithEvidence(repo, {
        intent: 'Custom template test.',
        tests: [{ id: 't1', command: 'node --version', status: 'passed', exitCode: 0 }]
      })

      const templatesDir = path.join(repo, '.forgedesk', 'templates')
      mkdirSync(templatesDir, { recursive: true })
      writeFileSync(
        path.join(templatesDir, 'PR_BODY.md'),
        '## Custom PR\n\nIntent: {{session.intent}}\nBranch: {{git.branch}}',
        'utf8'
      )

      expect(runCli(repo, ['evidence']).status).toBe(0)

      const sessionId = JSON.parse(readFileSync(path.join(repo, '.forgedesk', 'config.json'), 'utf8')).activeSessionId
      const prBody = readFileSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'PR_BODY.md'), 'utf8')
      expect(prBody).toContain('## Custom PR')
      expect(prBody).toContain('Intent: Custom template test.')
      expect(prBody).toContain('Branch:')

      // Other files use built-in templates
      const summary = readFileSync(path.join(repo, '.forgedesk', 'evidence', sessionId, 'SUMMARY.md'), 'utf8')
      expect(summary).toContain('# ForgeDesk Summary')
    })

    it('templates CLI shows status', () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

      const result = runCli(repo, ['templates'])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('ForgeDesk Templates')
      expect(result.stdout).toContain('PR_BODY.md: builtin')
    })

    it('templates --init generates example files', () => {
      const repo = tempDir()
      dirs.push(repo)
      initGitRepo(repo)
      expect(runCli(repo, ['init', '--repo', '.']).status).toBe(0)

      const result = runCli(repo, ['templates', '--init'])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Initialized 3 template(s)')
    })
  })
})
