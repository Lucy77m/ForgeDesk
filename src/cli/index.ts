#!/usr/bin/env node
import { Command } from 'commander'
import { pathToFileURL } from 'node:url'
import { addDecision, addManualCheck, addRisk, initProject, setIntent, startSession } from '../core/session.js'
import { renderAutoCaptureReport, runAutoCapture } from '../core/auto.js'
import { copyToClipboard } from '../core/clipboard.js'
import { getDoctorReport, renderDoctorReport } from '../core/doctor.js'
import { generateEvidence, getLatestEvidencePack, listEvidencePacks } from '../core/evidence.js'
import { ForgeDeskError } from '../core/errors.js'
import { exportEvidencePack, renderExportReport } from '../core/export.js'
import { getHandoffReport, renderHandoffReport } from '../core/handoff.js'
import { getInspectReport, renderInspectReport } from '../core/inspect.js'
import { getNextReport, renderNextReport } from '../core/next.js'
import { getReadyReport, renderReadyReport } from '../core/ready.js'
import { getReviewOutput } from '../core/review-output.js'
import { getStatus } from '../core/status.js'
import { recordTestCommand, runTestCommand } from '../core/test-runner.js'
import { getSessions } from '../core/sessions.js'
import { archiveSession, markActiveSessionDone, reopenSession, showSession } from '../core/lifecycle.js'
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
    .description('A local evidence desk for AI-assisted code changes.')
    .version('0.1.4')

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
    .command('auto')
    .description('Auto-capture local changes and generate pre-review materials.')
    .option('--no-run', 'do not run checks; capture local context only')
    .option('--title <title>', 'override the generated session title')
    .option('--json', 'print the auto-capture report as JSON')
    .action(async (options: { noRun?: boolean; title?: string; json?: boolean }) => {
      const report = await runAutoCapture(cwd, options)
      console.log(options.json ? JSON.stringify(report, null, 2) : renderAutoCaptureReport(report))
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await runCli()
}
