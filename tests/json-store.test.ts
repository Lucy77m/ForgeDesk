import path from 'node:path'
import { readdirSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { readJson, updateJson, writeJson } from '../src/storage/json-store.js'
import { cleanupDir, tempDir } from './helpers.js'

describe('json store', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      cleanupDir(dir)
    }
  })

  it('creates, reads, updates, and preserves data', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const file = path.join(dir, 'nested', 'value.json')

    await writeJson(file, { name: 'ForgeDesk', count: 1 })
    await updateJson<{ name: string; count: number }>(file, (value) => ({
      ...value,
      count: value.count + 1
    }))

    await expect(readJson(file)).resolves.toEqual({ name: 'ForgeDesk', count: 2 })
  })

  it('serializes concurrent updates without losing writes', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const file = path.join(dir, 'nested', 'counter.json')

    await writeJson(file, { count: 0 })
    await Promise.all(
      Array.from({ length: 20 }, () =>
        updateJson<{ count: number }>(file, (value) => ({
          count: value.count + 1
        }))
      )
    )

    await expect(readJson(file)).resolves.toEqual({ count: 20 })
    expect(readdirSync(path.dirname(file)).some((name) => name.endsWith('.lock') || name.endsWith('.tmp'))).toBe(false)
  })
})
