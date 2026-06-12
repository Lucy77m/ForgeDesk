import { mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { captureGitSnapshot, parseRecentCommits, parseStatus } from '../src/git/snapshot.js'
import { cleanupDir, git, initGitRepo, tempDir } from './helpers.js'

describe('git snapshot', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('parses modified, added, deleted, and untracked files', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    writeFileSync(path.join(repo, 'README.md'), '# Demo changed\n', 'utf8')
    writeFileSync(path.join(repo, 'added.txt'), 'added\n', 'utf8')
    git(repo, ['add', 'added.txt'])
    unlinkSync(path.join(repo, 'delete-me.txt'))
    writeFileSync(path.join(repo, 'untracked.txt'), 'untracked\n', 'utf8')

    const snapshot = captureGitSnapshot(repo)

    expect(snapshot.modifiedFiles).toContain('README.md')
    expect(snapshot.addedFiles).toContain('added.txt')
    expect(snapshot.deletedFiles).toContain('delete-me.txt')
    expect(snapshot.untrackedFiles).toContain('untracked.txt')
    expect(snapshot.isDirty).toBe(true)
  })

  it('ignores ForgeDesk local metadata in captured dirty files', () => {
    const repo = tempDir()
    dirs.push(repo)
    initGitRepo(repo)

    mkdirSync(path.join(repo, '.forgedesk'), { recursive: true })
    writeFileSync(path.join(repo, '.forgedesk', 'local.json'), '{}\n', 'utf8')

    const snapshot = captureGitSnapshot(repo)

    expect(snapshot.untrackedFiles).not.toContain('.forgedesk/local.json')
    expect(snapshot.isDirty).toBe(false)
  })
})

describe('git snapshot parsers', () => {
  it('groups porcelain status entries and normalizes paths', () => {
    expect(
      parseStatus(
        [
          ' M src\\core\\auto.ts',
          'A  src/new.ts',
          ' D old\\removed.ts',
          '?? notes\\todo.md',
          'R  src\\old-name.ts -> src\\new-name.ts',
          'MM src/mixed.ts',
          ' M src\\core\\auto.ts',
          '?? .forgedesk/evidence/session/evidence.json'
        ].join('\n')
      )
    ).toEqual({
      modifiedFiles: ['src/core/auto.ts', 'src/new-name.ts', 'src/mixed.ts'],
      addedFiles: ['src/new.ts'],
      deletedFiles: ['old/removed.ts'],
      untrackedFiles: ['notes/todo.md']
    })
  })

  it('returns empty groups for empty status output', () => {
    expect(parseStatus('')).toEqual({
      modifiedFiles: [],
      addedFiles: [],
      deletedFiles: [],
      untrackedFiles: []
    })
  })

  it('parses recent commits with optional dates', () => {
    expect(
      parseRecentCommits(
        [
          'abc123\u001fAdd next runner\u001f2026-06-13T10:00:00+08:00',
          'def456\u001fPrepare release'
        ].join('\n')
      )
    ).toEqual([
      {
        hash: 'abc123',
        message: 'Add next runner',
        date: '2026-06-13T10:00:00+08:00'
      },
      {
        hash: 'def456',
        message: 'Prepare release',
        date: undefined
      }
    ])
  })

  it('returns no recent commits for empty log output', () => {
    expect(parseRecentCommits('')).toEqual([])
  })
})
