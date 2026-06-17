import path from 'node:path'
import { readJson } from '../storage/json-store.js'
import type { GitSnapshot, RiskHint } from '../types.js'
import { pathExists, pathsFor } from './workspace.js'

export type RiskRule = {
  name: string
  pattern: string
  message: string
  severity: RiskHint['severity']
  confidence: RiskHint['confidence']
}

type RulesFile = {
  schemaVersion: string
  rules: Array<{
    name?: unknown
    pattern?: unknown
    message?: unknown
    severity?: unknown
    confidence?: unknown
    enabled?: unknown
  }>
}

function changedFiles(snapshot: GitSnapshot): string[] {
  return [
    ...snapshot.modifiedFiles,
    ...snapshot.addedFiles,
    ...snapshot.deletedFiles,
    ...snapshot.untrackedFiles
  ].map((file) => file.replaceAll('\\', '/'))
}

function hasPath(files: string[], pattern: RegExp): boolean {
  return files.some((file) => pattern.test(file.toLowerCase()))
}

function hint(text: string, source: string, severity: RiskHint['severity'], confidence: RiskHint['confidence']): RiskHint {
  return { text, source, severity, confidence }
}

export function deriveRiskHints(snapshot: GitSnapshot): RiskHint[] {
  const files = changedFiles(snapshot)
  const hints: RiskHint[] = []

  if (hasPath(files, /(^|\/)(auth|login|session|token)(\/|\.|-|_)/)) {
    hints.push(hint('Auth-related files changed. Review session handling, tokens, and redirect validation.', 'rule:path-auth', 'medium', 'high'))
  }
  if (hasPath(files, /(^|\/)(payment|billing|stripe)(\/|\.|-|_)/)) {
    hints.push(hint('Payment or billing files changed. Review charge, subscription, and webhook behavior.', 'rule:path-payment', 'high', 'high'))
  }
  if (hasPath(files, /(^|\/)(config|env|settings)(\/|\.|-|_)|\.env|config\./)) {
    hints.push(hint('Configuration-related files changed. Review environment and compatibility impact.', 'rule:path-config', 'medium', 'high'))
  }
  if (hasPath(files, /(^|\/)(migration|migrations|schema|db|database)(\/|\.|-|_)/)) {
    hints.push(hint('Database or schema files changed. Review migration and rollback behavior.', 'rule:path-database', 'high', 'high'))
  }
  if (hasPath(files, /(^|\/)\.github\/workflows\/|(^|\/)(ci|workflow)(\/|\.|-|_)/)) {
    hints.push(hint('CI or workflow files changed. Review automation and release pipeline behavior.', 'rule:path-workflow', 'medium', 'high'))
  }
  if (files.some((file) => ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'].includes(file))) {
    hints.push(hint('Package metadata or lockfile changed. Review dependency and script behavior.', 'rule:package-metadata', 'medium', 'high'))
  }
  if (snapshot.deletedFiles.length > 0) {
    hints.push(hint('Files were deleted. Review whether the removal is intentional and covered by tests.', 'rule:file-deleted', 'medium', 'high'))
  }
  if (files.length > 10) {
    hints.push(hint('More than 10 files changed. Review scope and look for unrelated edits.', 'rule:large-change', 'medium', 'medium'))
  }

  return hints
}

const RULES_SCHEMA_VERSION = 'forgedesk-rules-v1'
const RULES_FILE = 'rules.json'

function isValidSeverity(value: unknown): value is RiskHint['severity'] {
  return value === 'low' || value === 'medium' || value === 'high'
}

function parseRule(entry: RulesFile['rules'][number]): RiskRule | undefined {
  if (typeof entry.name !== 'string' || !entry.name.trim()) return undefined
  if (typeof entry.pattern !== 'string' || !entry.pattern.trim()) return undefined
  if (typeof entry.message !== 'string' || !entry.message.trim()) return undefined
  if (!isValidSeverity(entry.severity)) return undefined
  if (!isValidSeverity(entry.confidence)) return undefined
  if (entry.enabled === false) return undefined

  return {
    name: entry.name.trim(),
    pattern: entry.pattern.trim(),
    message: entry.message.trim(),
    severity: entry.severity,
    confidence: entry.confidence
  }
}

export async function loadCustomRules(repoPath: string): Promise<RiskRule[]> {
  const rulesPath = path.join(pathsFor(repoPath).forgedeskDir, RULES_FILE)
  if (!(await pathExists(rulesPath))) {
    return []
  }

  try {
    const file = await readJson<RulesFile>(rulesPath)
    if (file.schemaVersion !== RULES_SCHEMA_VERSION) {
      return []
    }
    if (!Array.isArray(file.rules)) {
      return []
    }
    return file.rules.map(parseRule).filter((rule): rule is RiskRule => rule !== undefined)
  } catch {
    return []
  }
}

export async function deriveRiskHintsAsync(repoPath: string, snapshot: GitSnapshot): Promise<RiskHint[]> {
  const builtin = deriveRiskHints(snapshot)
  const custom = await loadCustomRules(repoPath)

  if (custom.length === 0) {
    return builtin
  }

  const files = changedFiles(snapshot)
  const customHints: RiskHint[] = []
  const overrideNames = new Set(custom.map((r) => r.name))

  for (const rule of custom) {
    try {
      if (hasPath(files, new RegExp(rule.pattern, 'i'))) {
        customHints.push(hint(rule.message, `rule:${rule.name}`, rule.severity, rule.confidence))
      }
    } catch {
      // Invalid regex pattern — skip this rule
    }
  }

  return [
    ...builtin.filter((h) => !overrideNames.has(h.source.replace('rule:', ''))),
    ...customHints
  ]
}
