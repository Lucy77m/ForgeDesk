import { describe, expect, it } from 'vitest'
import { copyToClipboard, type ClipboardRunner } from '../src/core/clipboard.js'

describe('clipboard helper', () => {
  it('copies text with the first available clipboard command', () => {
    const calls: Array<{ command: string; args: string[]; input: string }> = []
    const runner: ClipboardRunner = (command, args, input) => {
      calls.push({ command, args, input })
      return { status: 0 }
    }

    copyToClipboard('review context', runner)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe('review context')
  })

  it('reports clipboard failures without falling back to stdout', () => {
    const calls: string[] = []
    const runner: ClipboardRunner = (command) => {
      calls.push(command)
      return { status: 1, stderr: `${command} failed` }
    }

    expect(() => copyToClipboard('pr body', runner)).toThrow('Could not copy to clipboard')
    expect(calls.length).toBeGreaterThan(0)
  })
})
