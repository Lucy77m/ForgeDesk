import { readJson, writeJson } from '../storage/json-store.js'
import { displayPath } from '../templates/format.js'
import { AUTO_CONFIG_SCHEMA_VERSION, type AutoConfig, type AutoMode } from '../types.js'
import { ForgeDeskError } from './errors.js'
import { nowIso } from './ids.js'
import { loadWorkspace, pathExists, pathsFor, type Workspace } from './workspace.js'

export const AUTO_MODES = ['manual', 'assist', 'local-auto', 'guarded'] as const

type AutoConfigSource = 'file' | 'default'

export type AutoModeDetails = {
  mode: AutoMode
  summary: string
  hooks: string
  watch: string
}

export type AutoConfigReport = {
  schemaVersion: 'forgedesk-auto-config-report-v1'
  generatedAt: string
  repoPath: string
  path: string
  source: AutoConfigSource
  config: AutoConfig
  details: AutoModeDetails
  next: string[]
}

export function isAutoMode(value: string): value is AutoMode {
  return AUTO_MODES.includes(value as AutoMode)
}

export function parseAutoMode(value: string): AutoMode {
  if (!isAutoMode(value)) {
    throw new ForgeDeskError(`Auto mode must be one of: ${AUTO_MODES.join(', ')}.`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateAutoConfig(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return 'JSON must be an object'
  }
  if (value.schemaVersion !== AUTO_CONFIG_SCHEMA_VERSION) {
    return `schemaVersion must be ${AUTO_CONFIG_SCHEMA_VERSION}`
  }
  if (typeof value.mode !== 'string' || !isAutoMode(value.mode)) {
    return `mode must be one of ${AUTO_MODES.join(', ')}`
  }
  if (typeof value.createdAt !== 'string' || !value.createdAt.trim()) {
    return 'createdAt must be a non-empty string'
  }
  if (typeof value.updatedAt !== 'string' || !value.updatedAt.trim()) {
    return 'updatedAt must be a non-empty string'
  }
  return undefined
}

export function assertAutoConfig(value: unknown, filePath: string): AutoConfig {
  const error = validateAutoConfig(value)
  if (error) {
    throw new ForgeDeskError(`Invalid ForgeDesk auto config at ${displayPath(filePath)}: ${error}.`)
  }
  return value as AutoConfig
}

function newAutoConfig(mode: AutoMode): AutoConfig {
  const timestamp = nowIso()
  return {
    schemaVersion: AUTO_CONFIG_SCHEMA_VERSION,
    mode,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function defaultAutoConfig(): AutoConfig {
  return newAutoConfig('manual')
}

export function describeAutoMode(mode: AutoMode): AutoModeDetails {
  switch (mode) {
    case 'manual':
      return {
        mode,
        summary: 'ForgeDesk only moves when you run a command.',
        hooks: 'Git hooks should be disabled.',
        watch: 'Watch mode should only preview work unless you explicitly choose another mode.'
      }
    case 'assist':
      return {
        mode,
        summary: 'ForgeDesk may suggest the next local step, but it should not write new evidence automatically.',
        hooks: 'Git hooks may warn, but should not block.',
        watch: 'Watch mode may explain the next safe action without writing local files.'
      }
    case 'local-auto':
      return {
        mode,
        summary: 'Explicit local automation may refresh ForgeDesk evidence and exports.',
        hooks: 'Git hooks may refresh ForgeDesk files when safe, but must not run tests or modify product code.',
        watch: 'Watch mode may refresh evidence or export ready packs after local state changes.'
      }
    case 'guarded':
      return {
        mode,
        summary: 'Local gates may block git actions when evidence is missing, stale, or not ready.',
        hooks: 'Git hooks may block commit or push on evidence problems.',
        watch: 'Watch mode may stay advisory; git hooks or CI should enforce the gate.'
      }
  }
}

export async function readAutoConfig(workspace: Workspace): Promise<{ config: AutoConfig; source: AutoConfigSource }> {
  const filePath = pathsFor(workspace.repoPath).autoConfigFile
  if (!(await pathExists(filePath))) {
    return { config: defaultAutoConfig(), source: 'default' }
  }
  return {
    config: assertAutoConfig(await readJson<unknown>(filePath), filePath),
    source: 'file'
  }
}

export async function getAutoConfigReport(cwd: string): Promise<AutoConfigReport> {
  const workspace = await loadWorkspace(cwd)
  const { config, source } = await readAutoConfig(workspace)
  return {
    schemaVersion: 'forgedesk-auto-config-report-v1',
    generatedAt: nowIso(),
    repoPath: workspace.repoPath,
    path: pathsFor(workspace.repoPath).autoConfigFile,
    source,
    config,
    details: describeAutoMode(config.mode),
    next: source === 'default'
      ? ['Run "forgedesk auto-config set assist" to enable advisory local automation.']
      : ['Run "forgedesk auto-config set <mode>" to change the local automation profile.']
  }
}

export async function setAutoConfigMode(cwd: string, mode: AutoMode): Promise<AutoConfigReport> {
  const workspace = await loadWorkspace(cwd)
  const filePath = pathsFor(workspace.repoPath).autoConfigFile
  const current = await readAutoConfig(workspace)
  const timestamp = nowIso()
  const config: AutoConfig = {
    ...current.config,
    mode,
    createdAt: current.source === 'file' ? current.config.createdAt : timestamp,
    updatedAt: timestamp
  }
  await writeJson(filePath, config)
  return getAutoConfigReport(cwd)
}

export function renderAutoConfigReport(report: AutoConfigReport): string {
  return [
    'ForgeDesk Auto Config',
    '',
    `Mode: ${report.config.mode}`,
    `Source: ${report.source}`,
    `Path: ${displayPath(report.path)}`,
    `Repo: ${displayPath(report.repoPath)}`,
    '',
    '## Behavior',
    `- ${report.details.summary}`,
    `- Hooks: ${report.details.hooks}`,
    `- Watch: ${report.details.watch}`,
    '',
    '## Next',
    ...report.next.map((item) => `- ${item}`),
    '',
    'Auto profiles only control explicit local ForgeDesk automation. ForgeDesk still does not call AI, edit product code, commit, push, open PRs, tag, release, publish, upload, or run as a hidden background service.'
  ].join('\n')
}
