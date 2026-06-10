import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function tempDir(prefix = 'forgedesk-'): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function cleanupDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

export function git(repoPath: string, args: string[]): void {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    windowsHide: true
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout)
  }
}

export function initGitRepo(repoPath: string): void {
  mkdirSync(repoPath, { recursive: true })
  git(repoPath, ['init'])
  git(repoPath, ['config', 'user.email', 'forgedesk@example.test'])
  git(repoPath, ['config', 'user.name', 'ForgeDesk Test'])
  writeFileSync(path.join(repoPath, 'README.md'), '# Demo\n', 'utf8')
  writeFileSync(path.join(repoPath, 'delete-me.txt'), 'delete me\n', 'utf8')
  git(repoPath, ['add', '.'])
  git(repoPath, ['commit', '-m', 'initial commit'])
}

export function initEmptyGitRepo(repoPath: string): void {
  mkdirSync(repoPath, { recursive: true })
  git(repoPath, ['init'])
  git(repoPath, ['config', 'user.email', 'forgedesk@example.test'])
  git(repoPath, ['config', 'user.name', 'ForgeDesk Test'])
}

export function runCli(repoPath: string, args: string[]) {
  const cliPath = path.join(projectRoot, 'src', 'cli', 'index.ts')
  const tsxLoader = pathToFileURL(path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href
  return spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
    cwd: repoPath,
    encoding: 'utf8',
    windowsHide: true
  })
}
