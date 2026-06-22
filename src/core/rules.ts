import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { displayPath, listLinesOrNone } from '../templates/format.js'
import { ForgeDeskError } from './errors.js'
import { loadCustomRules } from './risk-rules.js'
import { loadWorkspace, pathExists, pathsFor } from './workspace.js'

export type RulesOptions = {
  preset?: string
  force?: boolean
  json?: boolean
}

export type RulesReport = {
  schemaVersion: 'forgedesk-rules-report-v1'
  generatedAt: string
  repoPath: string
  rulesPath: string
  action: 'show' | 'installed'
  preset?: string
  ruleCount: number
  warnings: string[]
}

const PRESETS_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'presets')

const validPresets = ['security', 'default'] as const

function isValidPreset(name: string): name is typeof validPresets[number] {
  return (validPresets as readonly string[]).includes(name)
}

export async function getRulesReport(cwd: string, options: RulesOptions = {}): Promise<RulesReport> {
  const workspace = await loadWorkspace(cwd)
  const rulesPath = path.join(workspace.forgedeskDir, 'rules.json')
  const warnings: string[] = []

  if (options.preset) {
    if (!isValidPreset(options.preset)) {
      throw new ForgeDeskError(`Unknown preset "${options.preset}". Available presets: ${validPresets.join(', ')}.`)
    }

    if ((await pathExists(rulesPath)) && !options.force) {
      const existing = await loadCustomRules(workspace.repoPath)
      throw new ForgeDeskError(
        `rules.json already exists with ${existing.length} rule(s). Use --force to overwrite.`
      )
    }

    const presetPath = path.join(PRESETS_DIR, `${options.preset}.json`)
    const presetContent = await readFile(presetPath, 'utf8')
    await writeFile(rulesPath, presetContent, 'utf8')

    const preset = JSON.parse(presetContent) as { rules?: unknown[] }
    const ruleCount = Array.isArray(preset.rules) ? preset.rules.length : 0

    return {
      schemaVersion: 'forgedesk-rules-report-v1',
      generatedAt: new Date().toISOString(),
      repoPath: workspace.repoPath,
      rulesPath: displayPath(rulesPath),
      action: 'installed',
      preset: options.preset,
      ruleCount,
      warnings
    }
  }

  // Show current rules status
  const rules = await loadCustomRules(workspace.repoPath)
  return {
    schemaVersion: 'forgedesk-rules-report-v1',
    generatedAt: new Date().toISOString(),
    repoPath: workspace.repoPath,
    rulesPath: displayPath(rulesPath),
    action: 'show',
    ruleCount: rules.length,
    warnings
  }
}

export function renderRulesReport(report: RulesReport): string {
  const sections = [
    'ForgeDesk Rules',
    '',
    `Repo: ${displayPath(report.repoPath)}`,
    `Rules file: ${report.rulesPath}`,
  ]

  if (report.action === 'installed') {
    sections.push(`Preset: ${report.preset}`)
    sections.push(`Installed: ${report.ruleCount} rule(s)`)
    sections.push('')
    sections.push(`Run "forgedesk risk-rules" or generate evidence to see these rules in action.`)
  } else {
    sections.push(`Rules: ${report.ruleCount} custom rule(s)`)
    if (report.ruleCount === 0) {
      sections.push('')
      sections.push('No custom rules configured. Run "forgedesk rules --preset security" to install a preset.')
    }
  }

  sections.push('')
  sections.push('## Warnings')
  sections.push(...listLinesOrNone(report.warnings))
  sections.push('')
  sections.push('Rules are local file-based configuration. They do not call AI, fetch from the network, or modify code.')

  return sections.join('\n')
}
