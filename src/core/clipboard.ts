import { spawnSync } from 'node:child_process'
import { platform } from 'node:os'
import { ForgeDeskError } from './errors.js'

export type ClipboardRunResult = {
  status: number | null
  stderr?: string
  error?: Error
}

export type ClipboardRunner = (command: string, args: string[], input: string) => ClipboardRunResult

export function defaultClipboardRunner(command: string, args: string[], input: string): ClipboardRunResult {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    windowsHide: true
  })

  return {
    status: result.status,
    stderr: result.stderr,
    error: result.error
  }
}

function clipboardCommands(): Array<{ command: string; args: string[] }> {
  switch (platform()) {
    case 'win32':
      return [{ command: 'clip', args: [] }]
    case 'darwin':
      return [{ command: 'pbcopy', args: [] }]
    default:
      return [
        { command: 'wl-copy', args: [] },
        { command: 'xclip', args: ['-selection', 'clipboard'] }
      ]
  }
}

export function copyToClipboard(text: string, runner: ClipboardRunner = defaultClipboardRunner): void {
  const failures: string[] = []

  for (const { command, args } of clipboardCommands()) {
    const result = runner(command, args, text)
    if (result.status === 0 && !result.error) {
      return
    }
    failures.push(result.error?.message || result.stderr?.trim() || `${command} exited with ${result.status ?? 'unknown status'}`)
  }

  throw new ForgeDeskError(
    `Could not copy to clipboard. Re-run without --copy to print the text. Details: ${failures.join('; ')}`
  )
}
