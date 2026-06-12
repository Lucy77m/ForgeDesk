import type { GitSnapshot, RiskHint } from '../types.js'

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
