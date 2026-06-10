import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as T
}

export async function writeJson<T>(filePath: string, value: T): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}

export async function updateJson<T>(
  filePath: string,
  updater: (value: T) => T | Promise<T>
): Promise<T> {
  const current = await readJson<T>(filePath)
  const next = await updater(current)
  await writeJson(filePath, next)
  return next
}
