#!/usr/bin/env node
import { Command } from 'commander'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { addDecision, addManualCheck, addRisk, initProject, setIntent, startSession } from '../core/session.js'
import { renderAutoCaptureReport, runAutoCapture } from '../core/auto.js'
import { getAutoConfigReport, parseAutoMode, renderAutoConfigReport, setAutoConfigMode } from '../core/auto-config.js'
import { getCiCheckReport, initCiWorkflow, renderCiCheckReport, renderCiInitReport, renderCiWorkflow } from '../core/ci.js'
import { getContextReport, refreshContextFile, renderContextReport } from '../core/context.js'
import { copyToClipboard } from '../core/clipboard.js'
import { getDoctorReport, renderDoctorReport } from '../core/doctor.js'
import { getEpisodeStatus, renderEpisodeStatus } from '../core/episodes.js'
import { generateEvidence, getLatestEvidencePack, listEvidencePacks } from '../core/evidence.js'
import { ForgeDeskError } from '../core/errors.js'
import { exportEvidencePack, renderExportReport } from '../core/export.js'
import { getFixContextReport, renderFixContext } from '../core/fix-context.js'
import { getHandoffReport, renderHandoffReport } from '../core/handoff.js'
import {
  getHooksStatus,
  installHooks,
  parseHookName,
  renderHookRun,
  renderHooksInstall,
  renderHooksStatus,
  runHook,
  uninstallHooks
} from '../core/hooks.js'
import { getIgnitionStatus, installIgnition, renderIgnitionReport, uninstallIgnition } from '../core/ignition.js'
import { getInspectReport, renderInspectReport } from '../core/inspect.js'
import { getNextReport, renderNextReport } from '../core/next.js'
import { refreshNowFile, renderNowReport } from '../core/now.js'
import { openLocalTarget, parseOpenTarget, renderOpenReport } from '../core/open.js'
import { getReadyReport, renderReadyReport } from '../core/ready.js'
import { renderRepairReport, repairLocalSetup } from '../core/repair.js'
import { getReviewOutput } from '../core/review-output.js'
import { getShortcutsStatus, installShortcuts, renderShortcutsReport, uninstallShortcuts } from '../core/shortcuts.js'
import { getStatus } from '../core/status.js'
import { discoverTestScripts, renderTestDiscoveryReport } from '../core/test-discovery.js'
import { recordTestCommand, runTestCommand } from '../core/test-runner.js'
import { getSessions } from '../core/sessions.js'
import { archiveSession, markActiveSessionDone, reopenSession, showSession } from '../core/lifecycle.js'
import { renderSetupReport, runSetup } from '../core/setup.js'
import { getWatchReport, parseWatchInterval, renderQuietWatchReport, renderWatchReport, startWatch } from '../core/watch.js'
import type { ChangeSession } from '../types.js'

const riskSeverities = ['low', 'medium', 'high'] as const
const sessionStatuses = ['active', 'needs-review', 'done', 'archived'] as const

function isSessionStatus(status: string): status is ChangeSession['status'] {
  return sessionStatuses.includes(status as ChangeSession['status'])
}

function parseSessionStatus(status: string | undefined): ChangeSession['status'] | undefined {
  if (!status) {
    return undefined
  }
  if (!isSessionStatus(status)) {
    throw new ForgeDeskError('Session status must be one of: active, needs-review, done, archived.')
  }
  return status
}

export function buildProgram(cwd = process.cwd()): Command {
  const program = new Command()

  program
    .name('forgedesk')
    .description('A local auto-capture desk for AI-assisted code changes.')
    .version('0.5.5')

  program
    .command('init')
    .description('Initialize ForgeDesk metadata in a git repository.')
    .option('--repo <path>', 'repository path', '.')
    .action(async (options: { repo: string }) => {
      const project = await initProject(options.repo, cwd)
      console.log(`Initialized ForgeDesk for ${project.name}`)
      console.log(`Repo: ${project.repoPath}`)
    })

  program
    .command('setup')
    .description('Initialize and repair a local ForgeDesk run-button setup.')
    .option('--mode <mode>', 'auto profile to set: manual, assist, local-auto, or guarded', 'assist')
    .option('--package-scripts', 'also install ForgeDesk package scripts')
    .option('--test-tasks', 'also install discovered package test tasks')
    .option('--ignition', 'also install the folder-open watch task')
    .option('--hooks', 'also install ForgeDesk-managed git hooks')
    .option('--json', 'print the setup report as JSON')
    .action(async (options: {
      mode: string
      packageScripts?: boolean
      testTasks?: boolean
      ignition?: boolean
      hooks?: boolean
      json?: boolean
    }) => {
      const report = await runSetup(cwd, {
        mode: parseAutoMode(options.mode),
        packageScripts: options.packageScripts,
        testTasks: options.testTasks,
        ignition: options.ignition,
        hooks: options.hooks,
        cliPath: process.argv[1] ?? fileURLToPath(import.meta.url)
      })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderSetupReport(report))
      if (report.repair.blockers.length > 0) {
        process.exitCode = 1
      }
    })

  program
    .command('auto')
    .description('Auto-capture local changes and generate pre-review materials.')
    .option('--no-run', 'do not run checks; capture local context only')
    .option('--title <title>', 'override the generated session title')
    .option('--json', 'print the auto-capture report as JSON')
    .action(async (options: { noRun?: boolean; title?: string; json?: boolean }) => {
      const report = await runAutoCapture(cwd, options)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderAutoCaptureReport(report))
    })

  const autoConfig = program
    .command('auto-config')
    .description('Show or set the local ForgeDesk automation profile.')
    .option('--json', 'print the auto config report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await getAutoConfigReport(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderAutoConfigReport(report))
    })

  autoConfig
    .command('show')
    .description('Show the local ForgeDesk automation profile.')
    .option('--json', 'print the auto config report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await getAutoConfigReport(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderAutoConfigReport(report))
    })

  autoConfig
    .command('set')
    .description('Set the local ForgeDesk automation profile.')
    .argument('<mode>', 'manual, assist, local-auto, or guarded')
    .option('--json', 'print the auto config report as JSON')
    .action(async (mode: string, options: { json?: boolean }) => {
      const report = await setAutoConfigMode(cwd, parseAutoMode(mode))
      console.log(options.json ? JSON.stringify(report, null, 2) : renderAutoConfigReport(report))
    })

  const hooks = program
    .command('hooks')
    .description('Install, remove, or run local ForgeDesk git hooks.')

  hooks
    .command('status')
    .description('Show local ForgeDesk git hook status.')
    .option('--json', 'print the hooks status report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await getHooksStatus(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderHooksStatus(report))
    })

  hooks
    .command('install')
    .description('Install ForgeDesk-managed pre-commit and pre-push hooks in this repository.')
    .option('--json', 'print the hooks install report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await installHooks(cwd, process.argv[1] ?? fileURLToPath(import.meta.url))
      console.log(options.json ? JSON.stringify(report, null, 2) : renderHooksInstall(report))
    })

  hooks
    .command('uninstall')
    .description('Remove ForgeDesk-managed git hooks from this repository.')
    .option('--json', 'print the hooks uninstall report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await uninstallHooks(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderHooksInstall(report))
    })

  hooks
    .command('run')
    .description('Run one ForgeDesk hook check. Used by ForgeDesk-managed git hooks.')
    .argument('<hook>', 'pre-commit or pre-push')
    .option('--json', 'print the hook run report as JSON')
    .action(async (hook: string, options: { json?: boolean }) => {
      const report = await runHook(cwd, parseHookName(hook))
      console.log(options.json ? JSON.stringify(report, null, 2) : renderHookRun(report))
      if (report.outcome === 'blocked') {
        process.exitCode = 1
      }
    })

  program
    .command('watch')
    .description('Run foreground local ForgeDesk watch mode.')
    .option('--once', 'evaluate once and exit')
    .option('--interval <ms>', 'polling interval in milliseconds; minimum 500', '2000')
    .option('--quiet', 'print compact human-readable watch output')
    .option('--json', 'print watch reports as JSON')
    .action(async (options: { once?: boolean; interval?: string; quiet?: boolean; json?: boolean }) => {
      const intervalMs = parseWatchInterval(options.interval)
      if (options.once) {
        const report = await getWatchReport(cwd)
        await refreshNowFile(cwd).catch(() => undefined)
        console.log(options.json ? JSON.stringify(report, null, 2) : options.quiet ? renderQuietWatchReport(report) : renderWatchReport(report))
        if (report.status === 'error') {
          process.exitCode = 1
        }
        return
      }
      if (!options.quiet) {
        console.log('ForgeDesk watch is running in the foreground. Press Ctrl+C to stop.')
      }
      await startWatch(cwd, { intervalMs, json: options.json, quiet: options.quiet })
    })

  const shortcuts = program
    .command('shortcuts')
    .description('Install or remove local editor and package shortcuts for ForgeDesk.')

  const ignition = program
    .command('ignition')
    .description('Install or remove the local folder-open ForgeDesk watch task.')

  ignition
    .command('status')
    .description('Show local ForgeDesk ignition task status.')
    .option('--json', 'print the ignition report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await getIgnitionStatus(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderIgnitionReport(report))
    })

  ignition
    .command('install')
    .description('Install the folder-open ForgeDesk watch task.')
    .option('--json', 'print the ignition report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await installIgnition(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderIgnitionReport(report))
    })

  ignition
    .command('uninstall')
    .description('Remove the ForgeDesk-managed ignition task.')
    .option('--json', 'print the ignition report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await uninstallIgnition(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderIgnitionReport(report))
    })

  shortcuts
    .command('status')
    .description('Show local ForgeDesk shortcut status.')
    .option('--package-scripts', 'include package.json script status')
    .option('--test-tasks', 'include discovered package test task status')
    .option('--json', 'print the shortcuts report as JSON')
    .action(async (options: { packageScripts?: boolean; testTasks?: boolean; json?: boolean }) => {
      const report = await getShortcutsStatus(cwd, {
        packageScripts: options.packageScripts,
        testTasks: options.testTasks
      })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderShortcutsReport(report))
    })

  const ci = program
    .command('ci')
    .description('Check or generate a local ForgeDesk CI evidence gate.')

  ci
    .command('check')
    .description('Check local ForgeDesk evidence for CI gating.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--json', 'print the CI check report as JSON')
    .action(async (options: { session?: string; json?: boolean }) => {
      const report = await getCiCheckReport(cwd, { sessionId: options.session })
      await refreshNowFile(cwd).catch(() => undefined)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderCiCheckReport(report))
      if (report.status !== 'pass') {
        process.exitCode = 1
      }
    })

  ci
    .command('print')
    .description('Print a GitHub Actions ForgeDesk evidence gate workflow.')
    .action(() => {
      process.stdout.write(renderCiWorkflow())
    })

  ci
    .command('init')
    .description('Write a GitHub Actions ForgeDesk evidence gate workflow.')
    .option('--force', 'overwrite an existing ForgeDesk evidence workflow')
    .option('--json', 'print the CI init report as JSON')
    .action(async (options: { force?: boolean; json?: boolean }) => {
      const report = await initCiWorkflow(cwd, { force: options.force })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderCiInitReport(report))
    })

  shortcuts
    .command('install')
    .description('Install VS Code tasks and optional package scripts for ForgeDesk.')
    .option('--package-scripts', 'also install package.json scripts')
    .option('--test-tasks', 'also install discovered package test tasks')
    .option('--json', 'print the shortcuts report as JSON')
    .action(async (options: { packageScripts?: boolean; testTasks?: boolean; json?: boolean }) => {
      const report = await installShortcuts(cwd, {
        packageScripts: options.packageScripts,
        testTasks: options.testTasks
      })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderShortcutsReport(report))
    })

  shortcuts
    .command('uninstall')
    .description('Remove ForgeDesk-managed VS Code tasks and optional package scripts.')
    .option('--package-scripts', 'also remove ForgeDesk package.json scripts')
    .option('--test-tasks', 'also remove ForgeDesk-managed package test tasks')
    .option('--json', 'print the shortcuts report as JSON')
    .action(async (options: { packageScripts?: boolean; testTasks?: boolean; json?: boolean }) => {
      const report = await uninstallShortcuts(cwd, {
        packageScripts: options.packageScripts,
        testTasks: options.testTasks
      })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderShortcutsReport(report))
    })

  const tests = program
    .command('tests')
    .description('Discover local test commands for ForgeDesk buttons.')

  tests
    .command('discover')
    .description('Discover common package test scripts without running them.')
    .option('--json', 'print the test discovery report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await discoverTestScripts(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderTestDiscoveryReport(report))
    })

  program
    .command('context')
    .description('Generate a local AI-friendly context file for the active session.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--json', 'print the context report as JSON')
    .action(async (options: { session?: string; json?: boolean }) => {
      const report = await refreshContextFile(cwd, { sessionId: options.session })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderContextReport(report))
    })

  program
    .command('now')
    .description('Refresh and print the local ForgeDesk NOW.md status file.')
    .option('--json', 'print the NOW report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await refreshNowFile(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderNowReport(report))
    })

  program
    .command('open')
    .description('Open an existing local ForgeDesk file or directory.')
    .argument('[target]', 'now, evidence, export, review-context, or pr', 'now')
    .action(async (target: string | undefined) => {
      const report = await openLocalTarget(cwd, parseOpenTarget(target))
      console.log(renderOpenReport(report))
    })

  const episodes = program
    .command('episodes')
    .description('Inspect the current local ForgeDesk work episode.')

  episodes
    .command('status')
    .description('Show the active local work episode phase.')
    .option('--json', 'print the episode report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await getEpisodeStatus(cwd)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderEpisodeStatus(report))
    })

  program
    .command('repair')
    .description('Repair safe local ForgeDesk entry points and report stronger opt-ins.')
    .option('--package-scripts', 'also repair ForgeDesk package scripts')
    .option('--test-tasks', 'also repair discovered package test tasks')
    .option('--json', 'print the repair report as JSON')
    .action(async (options: { packageScripts?: boolean; testTasks?: boolean; json?: boolean }) => {
      const report = await repairLocalSetup(cwd, {
        packageScripts: options.packageScripts,
        testTasks: options.testTasks
      })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderRepairReport(report))
      if (report.blockers.length > 0) {
        process.exitCode = 1
      }
    })

  program
    .command('start')
    .description('Start a change session.')
    .requiredOption('--title <title>', 'change session title')
    .action(async (options: { title: string }) => {
      const session = await startSession(options.title, cwd)
      console.log(`Started session: ${session.title}`)
      console.log(`Session ID: ${session.id}`)
    })

  program
    .command('intent')
    .description('Record or replace the active session intent.')
    .argument('<text>', 'intent text')
    .action(async (text: string) => {
      const session = await setIntent(text, cwd)
      console.log(`Recorded intent for session: ${session.id}`)
    })

  program
    .command('decision')
    .description('Append a decision to the active session.')
    .argument('<text>', 'decision text')
    .action(async (text: string) => {
      const session = await addDecision(text, cwd)
      console.log(`Recorded decision. Total decisions: ${session.decisions.length}`)
    })

  program
    .command('risk')
    .description('Append a risk or review focus to the active session.')
    .argument('<text>', 'risk text')
    .option('--severity <severity>', 'low, medium, or high')
    .action(async (text: string, options: { severity?: 'low' | 'medium' | 'high' }) => {
      if (options.severity && !riskSeverities.includes(options.severity)) {
        throw new ForgeDeskError('Risk severity must be one of: low, medium, high.')
      }
      const session = await addRisk(text, cwd, options.severity)
      console.log(`Recorded risk. Total risks: ${session.risks.length}`)
    })

  program
    .command('check')
    .description('Record a manual verification check for the active session.')
    .argument('<text>', 'manual check text')
    .action(async (text: string) => {
      const session = await addManualCheck(text, cwd)
      console.log(`Recorded manual check. Total manual checks: ${session.manualChecks?.length ?? 0}`)
    })

  program
    .command('test')
    .description('Record or run a test command for the active session.')
    .option('--command <command>', 'record a test command without running it')
    .argument('[commandParts...]', 'command to run after --')
    .allowUnknownOption(true)
    .action(async (commandParts: string[], options: { command?: string }) => {
      if (options.command && commandParts.length > 0) {
        throw new ForgeDeskError('Use either --command or pass a command after "--", not both.')
      }

      const session = options.command
        ? await recordTestCommand(options.command, cwd)
        : await runTestCommand(commandParts, cwd)
      const latest = session.tests.at(-1)
      console.log(`Recorded test: ${latest?.command}`)
      console.log(`Status: ${latest?.status}`)
    })

  program
    .command('status')
    .description('Show ForgeDesk and git status.')
    .action(async () => {
      console.log(await getStatus(cwd))
    })

  program
    .command('next')
    .description('Run the next safe local ForgeDesk step.')
    .option('--dry-run', 'show the next step without writing local ForgeDesk files')
    .option('--json', 'print the next-step report as JSON')
    .action(async (options: { dryRun?: boolean; json?: boolean }) => {
      const report = await getNextReport(cwd, { dryRun: options.dryRun })
      await refreshNowFile(cwd).catch(() => undefined)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderNextReport(report))
      if (report.action === 'blocked') {
        process.exitCode = 1
      }
    })

  program
    .command('doctor')
    .description('Check local ForgeDesk project metadata and evidence files.')
    .option('--json', 'print the doctor report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await getDoctorReport(cwd)
      await refreshNowFile(cwd).catch(() => undefined)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderDoctorReport(report))
      if (report.status === 'error') {
        process.exitCode = 1
      }
    })

  program
    .command('ready')
    .description('Check whether a session evidence pack is ready for handoff.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--json', 'print the readiness report as JSON')
    .action(async (options: { session?: string; json?: boolean }) => {
      const report = await getReadyReport(cwd, options.session)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderReadyReport(report))
      if (!report.ready) {
        process.exitCode = 1
      }
    })

  program
    .command('handoff')
    .description('Print a local evidence handoff summary for a session.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--json', 'print the handoff report as JSON')
    .action(async (options: { session?: string; json?: boolean }) => {
      const report = await getHandoffReport(cwd, options.session)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderHandoffReport(report))
    })

  program
    .command('review-context')
    .description('Print or copy REVIEW_CONTEXT.md for a session.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--copy', 'copy the review context to the system clipboard')
    .action(async (options: { session?: string; copy?: boolean }) => {
      const output = await getReviewOutput(cwd, {
        sessionId: options.session,
        kind: 'review-context'
      })
      if (options.copy) {
        copyToClipboard(output.text)
        console.log(`Copied ${output.fileName} for session: ${output.session.id}`)
        return
      }
      process.stdout.write(output.text)
    })

  program
    .command('pr')
    .description('Print or copy PR_BODY.md for a session.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--copy', 'copy the PR body to the system clipboard')
    .action(async (options: { session?: string; copy?: boolean }) => {
      const output = await getReviewOutput(cwd, {
        sessionId: options.session,
        kind: 'pr'
      })
      if (options.copy) {
        copyToClipboard(output.text)
        console.log(`Copied ${output.fileName} for session: ${output.session.id}`)
        return
      }
      process.stdout.write(output.text)
    })

  program
    .command('fix-context')
    .description('Print or copy bounded context for fixing failed tests.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--copy', 'copy the fix context to the system clipboard')
    .action(async (options: { session?: string; copy?: boolean }) => {
      const report = await getFixContextReport(cwd, { sessionId: options.session })
      const text = renderFixContext(report)
      if (options.copy) {
        copyToClipboard(text)
        console.log(`Copied fix context for session: ${report.session.id}`)
        return
      }
      process.stdout.write(text)
    })

  program
    .command('export')
    .description('Copy a local evidence pack to an export directory.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--output-dir <dir>', 'output directory; defaults to .forgedesk/exports/<session-id>')
    .option('--json', 'print the export report as JSON')
    .action(async (options: { session?: string; outputDir?: string; json?: boolean }) => {
      const report = await exportEvidencePack(cwd, {
        sessionId: options.session,
        outputDir: options.outputDir
      })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderExportReport(report))
    })

  program
    .command('inspect')
    .description('Inspect local evidence or export files for a session.')
    .option('--session <id>', 'session id; defaults to the active session')
    .option('--export', 'inspect the default export directory instead of the evidence directory')
    .option('--json', 'print the inspect report as JSON')
    .action(async (options: { session?: string; export?: boolean; json?: boolean }) => {
      const report = await getInspectReport(cwd, {
        sessionId: options.session,
        target: options.export ? 'export' : 'evidence'
      })
      console.log(options.json ? JSON.stringify(report, null, 2) : renderInspectReport(report))
      if (!report.ok) {
        process.exitCode = 1
      }
    })

  program
    .command('sessions')
    .description('List ForgeDesk change sessions.')
    .option('--status <status>', 'filter by active, needs-review, done, or archived')
    .option('--all', 'include archived sessions')
    .action(async (options: { status?: string; all?: boolean }) => {
      console.log(await getSessions(cwd, {
        status: parseSessionStatus(options.status),
        all: options.all
      }))
    })

  program
    .command('show')
    .description('Show one ForgeDesk change session.')
    .option('--session <id>', 'session id; defaults to the active session')
    .action(async (options: { session?: string }) => {
      console.log(await showSession(cwd, options.session))
    })

  program
    .command('done')
    .description('Mark the active session as done.')
    .action(async () => {
      const session = await markActiveSessionDone(cwd)
      console.log(`Marked session done: ${session.id}`)
    })

  program
    .command('archive')
    .description('Archive a session.')
    .requiredOption('--session <id>', 'session id')
    .action(async (options: { session: string }) => {
      const session = await archiveSession(cwd, options.session)
      console.log(`Archived session: ${session.id}`)
    })

  program
    .command('reopen')
    .description('Reopen a done or archived session and make it active.')
    .requiredOption('--session <id>', 'session id')
    .action(async (options: { session: string }) => {
      const session = await reopenSession(cwd, options.session)
      console.log(`Reopened session: ${session.id}`)
    })

  program
    .command('evidence')
    .description('Generate evidence files for a session.')
    .option('--session <id>', 'session id')
    .option('--output-dir <dir>', 'output directory')
    .option('--list', 'list generated evidence packs without generating a new pack')
    .option('--latest', 'show the latest generated evidence pack without generating a new pack')
    .action(async (options: { session?: string; outputDir?: string; list?: boolean; latest?: boolean }) => {
      if (options.list && options.latest) {
        throw new ForgeDeskError('Use either --list or --latest, not both.')
      }
      if ((options.list || options.latest) && (options.session || options.outputDir)) {
        throw new ForgeDeskError('Use --list or --latest without --session or --output-dir.')
      }
      if (options.list) {
        console.log(await listEvidencePacks(cwd))
        return
      }
      if (options.latest) {
        console.log(await getLatestEvidencePack(cwd))
        return
      }

      const outputDir = await generateEvidence(cwd, {
        sessionId: options.session,
        outputDir: options.outputDir
      })
      console.log(`Generated evidence: ${outputDir}`)
    })

  return program
}

export async function runCli(argv = process.argv, cwd = process.cwd()): Promise<void> {
  try {
    await buildProgram(cwd).parseAsync(argv)
  } catch (error) {
    if (error instanceof ForgeDeskError) {
      console.error(`Error: ${error.message}`)
      process.exitCode = 1
      return
    }
    throw error
  }
}

export function isDirectCliInvocation(moduleUrl: string, argvPath = process.argv[1] ?? ''): boolean {
  if (!argvPath) {
    return false
  }

  try {
    return realpathSync.native(fileURLToPath(moduleUrl)) === realpathSync.native(argvPath)
  } catch {
    return fileURLToPath(moduleUrl) === argvPath
  }
}

if (isDirectCliInvocation(import.meta.url)) {
  await runCli()
}
