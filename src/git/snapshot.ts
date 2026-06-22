import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ForgeDeskError } from '../core/errors.js'
import type { GitSnapshot } from '../types.js'

export function runGit(repoPath: string, args: string[]): string {
  return runGitRaw(repoPath, args).trim()
}

export function runGitRaw(repoPath: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    windowsHide: true
  })

  if (result.error) {
    throw new ForgeDeskError(`Failed to run git: ${result.error.message}`, 'GIT_COMMAND_FAILED')
  }

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`
    throw new ForgeDeskError(message, 'GIT_COMMAND_FAILED')
  }

  return result.stdout
}

function tryRunGit(repoPath: string, args: string[]): string | undefined {
  try {
    return runGit(repoPath, args)
  } catch {
    return undefined
  }
}

function tryRunGitRaw(repoPath: string, args: string[]): string | undefined {
  try {
    return runGitRaw(repoPath, args)
  } catch {
    return undefined
  }
}

export function isGitRepo(repoPath: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: repoPath,
    encoding: 'utf8',
    windowsHide: true
  })
  return result.status === 0 && result.stdout.trim() === 'true'
}

export function gitRoot(repoPath: string): string {
  return runGit(repoPath, ['rev-parse', '--show-toplevel'])
}

function addUnique(files: string[], file: string): void {
  if (file && !files.includes(file)) {
    files.push(file)
  }
}

export function parseStatus(output: string): Pick<
  GitSnapshot,
  'modifiedFiles' | 'addedFiles' | 'deletedFiles' | 'untrackedFiles'
> {
  const modifiedFiles: string[] = []
  const addedFiles: string[] = []
  const deletedFiles: string[] = []
  const untrackedFiles: string[] = []

  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const x = line[0] ?? ' '
    const y = line[1] ?? ' '
    const rawFile = line.slice(3).trim()
    const file = rawFile.includes(' -> ') ? rawFile.split(' -> ').at(-1) ?? rawFile : rawFile
    const normalizedFile = file.replaceAll('\\', '/')

    if (normalizedFile === '.forgedesk' || normalizedFile.startsWith('.forgedesk/')) {
      continue
    }

    if (x === '?' && y === '?') {
      addUnique(untrackedFiles, normalizedFile)
      continue
    }

    if (x === 'D' || y === 'D') {
      addUnique(deletedFiles, normalizedFile)
    } else if (x === 'A' || y === 'A') {
      addUnique(addedFiles, normalizedFile)
    } else {
      addUnique(modifiedFiles, normalizedFile)
    }
  }

  return { modifiedFiles, addedFiles, deletedFiles, untrackedFiles }
}

export function parseRecentCommits(output: string): GitSnapshot['recentCommits'] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash = '', message = '', date] = line.split('\u001f')
      return { hash, message, date }
    })
}

function appendHash(hash: ReturnType<typeof createHash>, label: string, value: string): void {
  hash.update(`${label}\0${value.length}\0${value}\0`)
}

function fileContentFingerprint(repoPath: string, file: string): string {
  try {
    return createHash('sha256')
      .update(readFileSync(path.join(repoPath, file)))
      .digest('hex')
  } catch {
    return 'unreadable'
  }
}

export function createDiffFingerprint(
  repoPath: string,
  snapshot: Pick<GitSnapshot, 'branch' | 'head' | 'modifiedFiles' | 'addedFiles' | 'deletedFiles' | 'untrackedFiles'>,
  stagedDiff: string,
  worktreeDiff: string
): string {
  const hash = createHash('sha256')
  appendHash(hash, 'branch', snapshot.branch)
  appendHash(hash, 'head', snapshot.head)
  appendHash(hash, 'modified', snapshot.modifiedFiles.join('\n'))
  appendHash(hash, 'added', snapshot.addedFiles.join('\n'))
  appendHash(hash, 'deleted', snapshot.deletedFiles.join('\n'))
  appendHash(hash, 'untracked', snapshot.untrackedFiles.join('\n'))
  appendHash(hash, 'staged-diff', stagedDiff)
  appendHash(hash, 'worktree-diff', worktreeDiff)
  for (const file of [...snapshot.untrackedFiles].sort()) {
    appendHash(hash, `untracked:${file}`, fileContentFingerprint(repoPath, file))
  }
  return hash.digest('hex')
}

export function captureGitSnapshot(repoPath: string): GitSnapshot {
  if (!isGitRepo(repoPath)) {
    throw new ForgeDeskError(`Not a git repository: ${repoPath}`, 'NOT_A_GIT_REPO')
  }

  const branch = runGit(repoPath, ['branch', '--show-current']) || 'HEAD'
  const head = tryRunGit(repoPath, ['rev-parse', '--short', 'HEAD']) ?? 'unborn'
  const statusOutput = runGitRaw(repoPath, ['status', '--porcelain=v1', '-uall'])
  const stagedDiff = runGitRaw(repoPath, ['diff', '--cached', '--binary'])
  const worktreeDiff = runGitRaw(repoPath, ['diff', '--binary'])
  const recentCommitsOutput = tryRunGitRaw(repoPath, [
    'log',
    '-n',
    '5',
    '--pretty=format:%H%x1f%s%x1f%cd',
    '--date=iso-strict'
  ]) ?? ''
  const parsed = parseStatus(statusOutput)
  const diffFingerprint = createDiffFingerprint(
    repoPath,
    { branch, head, ...parsed },
    stagedDiff,
    worktreeDiff
  )

  return {
    branch,
    head,
    isDirty:
      parsed.modifiedFiles.length > 0 ||
      parsed.addedFiles.length > 0 ||
      parsed.deletedFiles.length > 0 ||
      parsed.untrackedFiles.length > 0,
    diffFingerprint,
    ...parsed,
    recentCommits: parseRecentCommits(recentCommitsOutput),
    capturedAt: new Date().toISOString()
  }
}

const MAX_DIFF_BYTES = 100 * 1024

export function readDiffContent(repoPath: string): string {
  const staged = tryRunGitRaw(repoPath, ['diff', '--cached']) ?? ''
  const worktree = tryRunGitRaw(repoPath, ['diff']) ?? ''
  const combined = staged + worktree
  return combined.length > MAX_DIFF_BYTES ? combined.slice(0, MAX_DIFF_BYTES) : combined
}
