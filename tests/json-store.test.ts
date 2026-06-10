import path from 'node:path'
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
})
