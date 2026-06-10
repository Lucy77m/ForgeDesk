import { readJson } from '../storage/json-store.js'
import {
  CONFIG_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  SESSION_SCHEMA_VERSION,
  type ChangeSession,
  type Config,
  type Project
} from '../types.js'
import { ForgeDeskError } from './errors.js'

type MetadataKind = 'project' | 'config' | 'session'

function displayPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === 'string' && value[key].trim() ? undefined : `${key} must be a non-empty string`
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  return value[key] === undefined || typeof value[key] === 'string' ? undefined : `${key} must be a string`
}

function requiredArray(value: Record<string, unknown>, key: string): string | undefined {
  return Array.isArray(value[key]) ? undefined : `${key} must be an array`
}

function assertRecord(value: unknown, kind: MetadataKind, filePath: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ForgeDeskError(`Invalid ForgeDesk ${kind} metadata at ${displayPath(filePath)}: JSON must be an object.`)
  }
  return value
}

function assertNoValidationError(error: string | undefined, kind: MetadataKind, filePath: string): void {
  if (error) {
    throw new ForgeDeskError(`Invalid ForgeDesk ${kind} metadata at ${displayPath(filePath)}: ${error}.`)
  }
}

export function validateProject(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return 'JSON must be an object'
  }
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    return `schemaVersion must be ${PROJECT_SCHEMA_VERSION}`
  }
  return (
    requiredString(value, 'name') ??
    requiredString(value, 'repoPath') ??
    optionalString(value, 'goal') ??
    optionalString(value, 'defaultBranch') ??
    requiredString(value, 'createdAt') ??
    requiredString(value, 'updatedAt')
  )
}

export function validateConfig(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return 'JSON must be an object'
  }
  if (value.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    return `schemaVersion must be ${CONFIG_SCHEMA_VERSION}`
  }
  return (
    optionalString(value, 'activeSessionId') ??
    requiredString(value, 'createdAt') ??
    requiredString(value, 'updatedAt')
  )
}

export function validateSession(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return 'JSON must be an object'
  }
  if (value.schemaVersion !== SESSION_SCHEMA_VERSION) {
    return `schemaVersion must be ${SESSION_SCHEMA_VERSION}`
  }
  if (!['active', 'needs-review', 'done', 'archived'].includes(String(value.status))) {
    return 'status must be one of active, needs-review, done, archived'
  }
  return (
    requiredString(value, 'id') ??
    requiredString(value, 'title') ??
    requiredArray(value, 'decisions') ??
    requiredArray(value, 'risks') ??
    requiredArray(value, 'tests') ??
    optionalString(value, 'intent') ??
    optionalString(value, 'evidenceDir') ??
    requiredString(value, 'createdAt') ??
    requiredString(value, 'updatedAt')
  )
}

export function assertProject(value: unknown, filePath: string): Project {
  const record = assertRecord(value, 'project', filePath)
  assertNoValidationError(validateProject(record), 'project', filePath)
  return record as Project
}

export function assertConfig(value: unknown, filePath: string): Config {
  const record = assertRecord(value, 'config', filePath)
  assertNoValidationError(validateConfig(record), 'config', filePath)
  return record as Config
}

export function assertSession(value: unknown, filePath: string): ChangeSession {
  const record = assertRecord(value, 'session', filePath)
  assertNoValidationError(validateSession(record), 'session', filePath)
  return record as ChangeSession
}

async function readMetadata<T>(
  filePath: string,
  kind: MetadataKind,
  assertValue: (value: unknown, filePath: string) => T
): Promise<T> {
  try {
    return assertValue(await readJson<unknown>(filePath), filePath)
  } catch (error) {
    if (error instanceof ForgeDeskError) {
      throw error
    }
    if (error instanceof SyntaxError) {
      throw new ForgeDeskError(`Could not read ForgeDesk ${kind} metadata at ${displayPath(filePath)}: invalid JSON.`)
    }
    throw error
  }
}

export function readProject(filePath: string): Promise<Project> {
  return readMetadata(filePath, 'project', assertProject)
}

export function readConfig(filePath: string): Promise<Config> {
  return readMetadata(filePath, 'config', assertConfig)
}

export function readChangeSession(filePath: string): Promise<ChangeSession> {
  return readMetadata(filePath, 'session', assertSession)
}
