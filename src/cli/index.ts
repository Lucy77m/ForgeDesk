#!/usr/bin/env node
import { Command } from 'commander'
import { pathToFileURL } from 'node:url'
import { addDecision, addManualCheck, addRisk, initProject, setIntent, startSession } from '../core/session.js'
import { generateEvidence } from '../core/evidence.js'
import { ForgeDeskError } from '../core/errors.js'
import { getStatus } from '../core/status.js'
import { recordTestCommand, runTestCommand } from '../core/test-runner.js'
import { getSessions } from '../core/sessions.js'

const riskSeverities = ['low', 'medium', 'high'] as const

export function buildProgram(cwd = process.cwd()): Command {
  const program = new Command()

  program
    .name('forgedesk')
    .description('A local evidence desk for AI-assisted code changes.')
    .version('0.1.0')

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
    .command('sessions')
    .description('List ForgeDesk change sessions.')
    .action(async () => {
      console.log(await getSessions(cwd))
    })

  program
    .command('evidence')
    .description('Generate evidence files for a session.')
    .option('--session <id>', 'session id')
    .option('--output-dir <dir>', 'output directory')
    .action(async (options: { session?: string; outputDir?: string }) => {
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
