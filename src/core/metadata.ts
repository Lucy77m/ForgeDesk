import { readJson } from '../storage/json-store.js'
import { displayPath } from '../templates/format.js'
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
type ValidationRule = (value: Record<string, unknown>) => string | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(key: string): ValidationRule {
  return (value) =>
    typeof value[key] === 'string' && value[key].trim() ? undefined : `${key} must be a non-empty string`
}

function optionalString(key: string): ValidationRule {
  return (value) => value[key] === undefined || typeof value[key] === 'string' ? undefined : `${key} must be a string`
}

function requiredArray(key: string): ValidationRule {
  return (value) => Array.isArray(value[key]) ? undefined : `${key} must be an array`
}

function sessionStatus(value: Record<string, unknown>): string | undefined {
  return ['active', 'needs-review', 'done', 'archived'].includes(String(value.status))
    ? undefined
    : 'status must be one of active, needs-review, done, archived'
}

function firstValidationError(value: Record<string, unknown>, rules: ValidationRule[]): string | undefined {
  for (const rule of rules) {
    const error = rule(value)
    if (error) {
      return error
    }
  }
  return undefined
}

function validateMetadata(value: unknown, schemaVersion: string, rules: ValidationRule[]): string | undefined {
  if (!isRecord(value)) {
    return 'JSON must be an object'
  }
  if (value.schemaVersion !== schemaVersion) {
    return `schemaVersion must be ${schemaVersion}`
  }
  return firstValidationError(value, rules)
}

function invalidMetadataError(kind: MetadataKind, filePath: string, error: string): ForgeDeskError {
  return new ForgeDeskError(`Invalid ForgeDesk ${kind} metadata at ${displayPath(filePath)}: ${error}.`)
}

function assertMetadata<T>(
  value: unknown,
  kind: MetadataKind,
  filePath: string,
  validateValue: (value: unknown) => string | undefined
): T {
  const error = validateValue(value)
  if (error) {
    throw invalidMetadataError(kind, filePath, error)
  }
  return value as T
}

const projectRules = [
  requiredString('name'),
  requiredString('repoPath'),
  optionalString('goal'),
  optionalString('defaultBranch'),
  requiredString('createdAt'),
  requiredString('updatedAt')
]

const configRules = [optionalString('activeSessionId'), requiredString('createdAt'), requiredString('updatedAt')]

const sessionRules = [
  sessionStatus,
  requiredString('id'),
  requiredString('title'),
  requiredArray('decisions'),
  requiredArray('risks'),
  requiredArray('tests'),
  optionalString('intent'),
  optionalString('evidenceDir'),
  requiredString('createdAt'),
  requiredString('updatedAt')
]

export function validateProject(value: unknown): string | undefined {
  return validateMetadata(value, PROJECT_SCHEMA_VERSION, projectRules)
}

export function validateConfig(value: unknown): string | undefined {
  return validateMetadata(value, CONFIG_SCHEMA_VERSION, configRules)
}

export function validateSession(value: unknown): string | undefined {
  return validateMetadata(value, SESSION_SCHEMA_VERSION, sessionRules)
}

export function assertProject(value: unknown, filePath: string): Project {
  return assertMetadata(value, 'project', filePath, validateProject)
}

export function assertConfig(value: unknown, filePath: string): Config {
  return assertMetadata(value, 'config', filePath, validateConfig)
}

export function assertSession(value: unknown, filePath: string): ChangeSession {
  return assertMetadata(value, 'session', filePath, validateSession)
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
