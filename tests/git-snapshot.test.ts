import { rmSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { captureGitSnapshot } from '../src/git/snapshot.js'
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
})
