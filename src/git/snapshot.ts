import { spawnSync } from 'node:child_process'
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
    throw new ForgeDeskError(`Failed to run git: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`
    throw new ForgeDeskError(message)
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

function parseStatus(output: string): Pick<
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
      addUnique(untrackedFiles, file)
      continue
    }

    if (x === 'D' || y === 'D') {
      addUnique(deletedFiles, file)
    } else if (x === 'A' || y === 'A') {
      addUnique(addedFiles, file)
    } else {
      addUnique(modifiedFiles, file)
    }
  }

  return { modifiedFiles, addedFiles, deletedFiles, untrackedFiles }
}

function parseRecentCommits(output: string): GitSnapshot['recentCommits'] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash = '', message = '', date] = line.split('\u001f')
      return { hash, message, date }
    })
}

export function captureGitSnapshot(repoPath: string): GitSnapshot {
  if (!isGitRepo(repoPath)) {
    throw new ForgeDeskError(`Not a git repository: ${repoPath}`)
  }

  const branch = runGit(repoPath, ['branch', '--show-current']) || 'HEAD'
  const head = tryRunGit(repoPath, ['rev-parse', '--short', 'HEAD']) ?? 'unborn'
  const statusOutput = runGitRaw(repoPath, ['status', '--porcelain=v1'])
  const recentCommitsOutput = tryRunGitRaw(repoPath, [
    'log',
    '-n',
    '5',
    '--pretty=format:%H%x1f%s%x1f%cd',
    '--date=iso-strict'
  ]) ?? ''
  const parsed = parseStatus(statusOutput)

  return {
    branch,
    head,
    isDirty:
      parsed.modifiedFiles.length > 0 ||
      parsed.addedFiles.length > 0 ||
      parsed.deletedFiles.length > 0 ||
      parsed.untrackedFiles.length > 0,
    ...parsed,
    recentCommits: parseRecentCommits(recentCommitsOutput),
    capturedAt: new Date().toISOString()
  }
}
