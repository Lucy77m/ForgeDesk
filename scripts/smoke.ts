import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

type CommandResult = {
  status: number | null
  stdout: string
  stderr: string
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliPath = path.join(projectRoot, 'dist', 'cli', 'index.js')

function run(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    shell: false
  })

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  }
}

function assertOk(label: string, result: CommandResult): void {
  if (result.status === 0) {
    return
  }

  throw new Error([
    `${label} failed with exit code ${result.status ?? 'unknown'}.`,
    result.stdout.trim() ? `stdout:\n${result.stdout.trim()}` : undefined,
    result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : undefined
  ].filter(Boolean).join('\n\n'))
}

function runOk(label: string, command: string, args: string[], cwd: string): CommandResult {
  const result = run(command, args, cwd)
  assertOk(label, result)
  return result
}

function git(repoPath: string, args: string[]): void {
  runOk(`git ${args.join(' ')}`, 'git', args, repoPath)
}

function forgedesk(repoPath: string, args: string[]): CommandResult {
  return runOk(`forgedesk ${args.join(' ')}`, process.execPath, [cliPath, ...args], repoPath)
}

function assertFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Expected file was not created: ${filePath}`)
  }
}

function initDemoRepo(repoPath: string): void {
  git(repoPath, ['init'])
  git(repoPath, ['config', 'user.email', 'forgedesk-smoke@example.test'])
  git(repoPath, ['config', 'user.name', 'ForgeDesk Smoke'])
  writeFileSync(path.join(repoPath, 'README.md'), '# ForgeDesk smoke demo\n', 'utf8')
  git(repoPath, ['add', '.'])
  git(repoPath, ['commit', '-m', 'initial commit'])
  writeFileSync(path.join(repoPath, 'README.md'), '# ForgeDesk smoke demo\n\nLocal smoke change.\n', 'utf8')
}

function main(): void {
  if (!existsSync(cliPath)) {
    throw new Error(`Compiled CLI not found at ${cliPath}. Run "pnpm build" before "pnpm smoke".`)
  }

  const repoPath = mkdtempSync(path.join(os.tmpdir(), 'forgedesk-smoke-'))
  try {
    initDemoRepo(repoPath)

    forgedesk(repoPath, ['init', '--repo', '.'])
    forgedesk(repoPath, ['start', '--title', 'Smoke verify evidence workflow'])
    forgedesk(repoPath, ['intent', 'Verify the compiled ForgeDesk CLI evidence workflow end to end.'])
    forgedesk(repoPath, ['decision', 'Use a temporary git repository so smoke output stays isolated.'])
    forgedesk(repoPath, ['risk', 'Smoke coverage is shallow and does not replace integration tests.', '--severity', 'low'])
    forgedesk(repoPath, ['check', 'Confirmed smoke output files exist in the temporary repository.'])
    forgedesk(repoPath, ['test', '--command', 'pnpm test'])
    forgedesk(repoPath, ['test', '--', 'node', '--version'])
    forgedesk(repoPath, ['evidence'])
    forgedesk(repoPath, ['ready'])
    forgedesk(repoPath, ['handoff'])
    forgedesk(repoPath, ['export'])
    forgedesk(repoPath, ['inspect'])
    forgedesk(repoPath, ['inspect', '--export'])

    const config = JSON.parse(readFileSync(path.join(repoPath, '.forgedesk', 'config.json'), 'utf8')) as {
      activeSessionId?: string
    }
    if (!config.activeSessionId) {
      throw new Error('Smoke workflow did not record an active session id.')
    }

    const evidenceDir = path.join(repoPath, '.forgedesk', 'evidence', config.activeSessionId)
    const exportDir = path.join(repoPath, '.forgedesk', 'exports', config.activeSessionId)
    for (const file of ['PR_EVIDENCE.md', 'CHANGE_SUMMARY.md', 'TEST_RESULTS.md', 'REVIEW_PROMPT.md', 'evidence.json']) {
      assertFile(path.join(evidenceDir, file))
      assertFile(path.join(exportDir, file))
    }
    assertFile(path.join(exportDir, 'HANDOFF.md'))

    console.log('ForgeDesk smoke passed')
    console.log(`Temporary repo cleaned: ${repoPath}`)
    console.log(`Session ID: ${config.activeSessionId}`)
  } finally {
    rmSync(repoPath, { recursive: true, force: true })
  }
}

main()
