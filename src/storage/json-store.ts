import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { dirname } from 'node:path'

const lockPollMs = 25
const lockTimeoutMs = 5000
const staleLockMs = 30000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function tempPathFor(filePath: string): string {
  const suffix = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`
  return `${filePath}.${suffix}.tmp`
}

async function writeJsonAtomic<T>(filePath: string, value: T): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = tempPathFor(filePath)
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(tempPath, filePath)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function removeStaleLock(lockPath: string): Promise<void> {
  const lockStat = await stat(lockPath).catch(() => undefined)
  if (!lockStat || Date.now() - lockStat.mtimeMs < staleLockMs) {
    return
  }
  await rm(lockPath, { force: true }).catch(() => undefined)
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined
}

function isLockBusyError(error: unknown): boolean {
  return ['EEXIST', 'EPERM', 'EACCES'].includes(errorCode(error) ?? '')
}

async function acquireJsonLock(filePath: string): Promise<{ handle: FileHandle; lockPath: string }> {
  await mkdir(dirname(filePath), { recursive: true })
  const lockPath = `${filePath}.lock`
  const startedAt = Date.now()

  while (true) {
    let handle: FileHandle | undefined
    try {
      handle = await open(lockPath, 'wx')
      await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`, 'utf8')
      return { handle, lockPath }
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => undefined)
      }
      if (isLockBusyError(error) && Date.now() - startedAt <= lockTimeoutMs) {
        await removeStaleLock(lockPath)
        await sleep(lockPollMs)
        continue
      }
      if (isLockBusyError(error)) {
        throw new Error(`Timed out waiting for JSON store lock: ${filePath}`)
      }
      throw error
    }
  }
}

async function withJsonLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const { handle, lockPath } = await acquireJsonLock(filePath)
  try {
    return await task()
  } finally {
    await handle.close()
    await rm(lockPath, { force: true }).catch(() => undefined)
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as T
}

export async function writeJson<T>(filePath: string, value: T): Promise<void> {
  await withJsonLock(filePath, () => writeJsonAtomic(filePath, value))
}

export async function updateJson<T>(
  filePath: string,
  updater: (value: T) => T | Promise<T>
): Promise<T> {
  return withJsonLock(filePath, async () => {
    const current = await readJson<T>(filePath)
    const next = await updater(current)
    await writeJsonAtomic(filePath, next)
    return next
  })
}
