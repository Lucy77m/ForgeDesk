import path from 'node:path'
import { existsSync, openSync, closeSync, readdirSync, utimesSync, writeFileSync } from 'node:fs'
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

  it('cleans up stale lock files automatically', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const file = path.join(dir, 'stale-lock.json')
    const lockFile = `${file}.lock`

    writeFileSync(lockFile, 'stale\n', 'utf8')
    const past = new Date(Date.now() - 60_000)
    utimesSync(lockFile, past, past)

    await writeJson(file, { recovered: true })

    await expect(readJson(file)).resolves.toEqual({ recovered: true })
    expect(existsSync(lockFile)).toBe(false)
  })

  it('throws a timeout error when lock cannot be acquired', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const file = path.join(dir, 'locked.json')
    const lockFile = `${file}.lock`

    const handle = openSync(lockFile, 'wx')

    try {
      await expect(writeJson(file, { blocked: true })).rejects.toThrow('Timed out waiting for JSON store lock')
    } finally {
      closeSync(handle)
    }
  })

  it('throws on corrupted JSON', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const file = path.join(dir, 'corrupt.json')

    writeFileSync(file, '{ invalid json content', 'utf8')

    await expect(readJson(file)).rejects.toThrow()
  })

  it('creates parent directories on write', async () => {
    const dir = tempDir()
    dirs.push(dir)
    const file = path.join(dir, 'a', 'b', 'c', 'deep.json')

    await writeJson(file, { depth: 3 })

    await expect(readJson(file)).resolves.toEqual({ depth: 3 })
    expect(existsSync(path.join(dir, 'a', 'b', 'c'))).toBe(true)
  })
})
