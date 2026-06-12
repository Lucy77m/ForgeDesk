import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { isDirectCliInvocation } from '../src/cli/index.js'

describe('CLI entrypoint detection', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('treats symlinked argv paths as direct invocation paths', () => {
    const root = path.join(os.tmpdir(), `forgedesk-cli-entry-${process.pid}-${Date.now()}`)
    dirs.push(root)
    mkdirSync(root, { recursive: true })

    const target = path.join(root, 'index.js')
    const link = path.join(root, 'forgedesk.js')
    writeFileSync(target, '#!/usr/bin/env node\n', 'utf8')

    try {
      symlinkSync(target, link)
    } catch {
      return
    }

    expect(isDirectCliInvocation(pathToFileURL(target).href, link)).toBe(true)
  })

  it('does not treat missing argv paths as direct invocation paths', () => {
    expect(isDirectCliInvocation(import.meta.url, '')).toBe(false)
  })
})
