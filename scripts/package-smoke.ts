import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

type CommandResult = {
  status: number | null
  stdout: string
  stderr: string
  error?: string
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedVersion = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version as string

function commandName(command: string): string {
  if (process.platform === 'win32') {
    const found = spawnSync('where.exe', [command], {
      encoding: 'utf8',
      windowsHide: true
    }).stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.toLowerCase().endsWith('.cmd'))

    if (found) {
      return found
    }
  }
  return command
}

function run(command: string, args: string[], cwd: string, shell = false): CommandResult {
  const result = spawnSync(
    shell ? [command, ...args].map(quoteShellArg).join(' ') : command,
    shell ? [] : args,
    {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    shell
    }
  )

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message
  }
}

function quoteShellArg(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`
}

function assertOk(label: string, result: CommandResult): void {
  if (result.status === 0) {
    return
  }

  throw new Error([
    `${label} failed with exit code ${result.status ?? 'unknown'}.`,
    result.error ? `error: ${result.error}` : undefined,
    result.stdout.trim() ? `stdout:\n${result.stdout.trim()}` : undefined,
    result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : undefined
  ].filter(Boolean).join('\n\n'))
}

function runOk(label: string, command: string, args: string[], cwd: string, shell = false): CommandResult {
  const result = run(command, args, cwd, shell)
  assertOk(label, result)
  return result
}

function git(repoPath: string, args: string[]): void {
  runOk(`git ${args.join(' ')}`, 'git', args, repoPath)
}

function initDemoRepo(repoPath: string): void {
  git(repoPath, ['init'])
  git(repoPath, ['config', 'user.email', 'forgedesk-package-smoke@example.test'])
  git(repoPath, ['config', 'user.name', 'ForgeDesk Package Smoke'])
  writeFileSync(path.join(repoPath, 'README.md'), '# ForgeDesk package smoke\n', 'utf8')
  git(repoPath, ['add', '.'])
  git(repoPath, ['commit', '-m', 'initial commit'])
  writeFileSync(path.join(repoPath, 'README.md'), '# ForgeDesk package smoke\n\nInstalled CLI change.\n', 'utf8')
}

function installedBin(installDir: string): string {
  return path.join(installDir, 'node_modules', '.bin', process.platform === 'win32' ? 'forgedesk.cmd' : 'forgedesk')
}

function installedCli(installDir: string): string {
  return path.join(installDir, 'node_modules', 'forgedesk', 'dist', 'cli', 'index.js')
}

function installedBinVersion(installDir: string): CommandResult {
  return runOk(
    'installed forgedesk --version',
    commandName('npm'),
    ['exec', '--prefix', installDir, '--', 'forgedesk', '--version'],
    installDir,
    process.platform === 'win32'
  )
}

function runInstalledForgeDesk(installDir: string, cwd: string, args: string[]): CommandResult {
  const bin = installedBin(installDir)
  if (!existsSync(bin)) {
    throw new Error(`Installed ForgeDesk bin was not found: ${bin}`)
  }
  const cli = installedCli(installDir)
  if (!existsSync(cli)) {
    throw new Error(`Installed ForgeDesk CLI entry was not found: ${cli}`)
  }
  return runOk(`installed forgedesk ${args.join(' ')}`, process.execPath, [cli, ...args], cwd)
}

function main(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'forgedesk-package-smoke-'))
  const packDir = path.join(root, 'pack')
  const installDir = path.join(root, 'install')
  const repoDir = path.join(root, 'repo')

  try {
    mkdirSync(packDir, { recursive: true })
    mkdirSync(installDir, { recursive: true })
    mkdirSync(repoDir, { recursive: true })

    runOk('pnpm pack', commandName('pnpm'), ['pack', '--pack-destination', packDir], projectRoot, process.platform === 'win32')
    const tarball = path.join(packDir, `forgedesk-${expectedVersion}.tgz`)
    if (!existsSync(tarball)) {
      throw new Error(`Expected package tarball was not created: ${tarball}`)
    }

    writeFileSync(path.join(installDir, 'package.json'), '{"private":true,"type":"module"}\n', 'utf8')
    runOk(
      'npm install package tarball',
      commandName('npm'),
      ['install', '--no-audit', '--no-fund', tarball],
      installDir,
      process.platform === 'win32'
    )

    const versionResult = installedBinVersion(installDir)
    const version = versionResult.stdout.trim()
    if (version !== expectedVersion) {
      throw new Error([
        `Installed ForgeDesk version mismatch: expected ${expectedVersion}, got ${version || '<empty>'}.`,
        versionResult.stdout.trim() ? `stdout:\n${versionResult.stdout.trim()}` : undefined,
        versionResult.stderr.trim() ? `stderr:\n${versionResult.stderr.trim()}` : undefined
      ].filter(Boolean).join('\n\n'))
    }

    initDemoRepo(repoDir)
    const preview = runInstalledForgeDesk(installDir, repoDir, ['next', '--dry-run', '--json'])
    const report = JSON.parse(preview.stdout) as { schemaVersion?: string; action?: string; reason?: string; dryRun?: boolean }
    if (report.schemaVersion !== 'forgedesk-next-v1' || report.action !== 'auto-capture' || report.reason !== 'dirty-no-session' || report.dryRun !== true) {
      throw new Error(`Unexpected installed next report: ${preview.stdout}`)
    }

    console.log('ForgeDesk package smoke passed')
    console.log(`Tarball: ${tarball}`)
    console.log(`Temporary root cleaned: ${root}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

main()
