import { CONDITION_DIMENSIONS, CURRENT_FORMAT_VERSION } from './constants'
import type { ConditionsFile, PublishProfile, VariablesFile, WorkspaceConfig } from './types'

export type ValidationResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: string[] }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function validatePublishProfile(name: string, value: unknown, errors: string[]): PublishProfile | undefined {
  if (!isPlainObject(value)) {
    errors.push(`publishProfiles.${name} must be an object`)
    return undefined
  }
  if (!isStringArray(value.audience)) {
    errors.push(`publishProfiles.${name}.audience must be an array of strings`)
    return undefined
  }
  if (!isStringArray(value.output)) {
    errors.push(`publishProfiles.${name}.output must be an array of strings`)
    return undefined
  }
  return { audience: value.audience, output: value.output }
}

export function validateWorkspaceConfig(json: unknown): ValidationResult<WorkspaceConfig> {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isPlainObject(json)) {
    return { ok: false, errors: ['workspace.json must be a JSON object'] }
  }

  if (typeof json.name !== 'string' || json.name.length === 0) {
    errors.push('workspace.json: "name" must be a non-empty string')
  }

  let site: WorkspaceConfig['site'] | undefined
  if (!isPlainObject(json.site)) {
    errors.push('workspace.json: "site" must be an object')
  } else if (typeof json.site.title !== 'string' || json.site.title.length === 0) {
    errors.push('workspace.json: "site.title" must be a non-empty string')
  } else if (json.site.logo !== undefined && typeof json.site.logo !== 'string') {
    errors.push('workspace.json: "site.logo" must be a string when present')
  } else {
    site = { title: json.site.title, ...(typeof json.site.logo === 'string' ? { logo: json.site.logo } : {}) }
  }

  let publishProfiles: WorkspaceConfig['publishProfiles'] | undefined
  if (!isPlainObject(json.publishProfiles)) {
    errors.push('workspace.json: "publishProfiles" must be an object')
  } else {
    const profiles: WorkspaceConfig['publishProfiles'] = {}
    for (const [profileName, profileValue] of Object.entries(json.publishProfiles)) {
      const profile = validatePublishProfile(profileName, profileValue, errors)
      if (profile) profiles[profileName] = profile
    }
    publishProfiles = profiles
  }

  let formatVersion: number | undefined
  if (typeof json.formatVersion !== 'number') {
    errors.push('workspace.json: "formatVersion" must be a number')
  } else {
    formatVersion = json.formatVersion
    if (formatVersion !== CURRENT_FORMAT_VERSION) {
      warnings.push(
        `workspace.json: formatVersion ${formatVersion} does not match the app's current version ${CURRENT_FORMAT_VERSION}`,
      )
    }
  }

  if (errors.length > 0 || !site || !publishProfiles || formatVersion === undefined) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: { name: json.name as string, site, publishProfiles, formatVersion },
    warnings,
  }
}

export function validateVariablesFile(json: unknown): ValidationResult<VariablesFile> {
  const errors: string[] = []

  if (!isPlainObject(json)) {
    return { ok: false, errors: ['variables.json must be a JSON object'] }
  }

  const value: VariablesFile = {}
  for (const [key, entry] of Object.entries(json)) {
    if (!isPlainObject(entry)) {
      errors.push(`variables.json: "${key}" must be an object`)
      continue
    }
    if (typeof entry.value !== 'string') {
      errors.push(`variables.json: "${key}.value" must be a string`)
      continue
    }
    if (typeof entry.description !== 'string') {
      errors.push(`variables.json: "${key}.description" must be a string`)
      continue
    }
    value[key] = { value: entry.value, description: entry.description }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value, warnings: [] }
}

export function validateConditionsFile(json: unknown): ValidationResult<ConditionsFile> {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isPlainObject(json)) {
    return { ok: false, errors: ['conditions.json must be a JSON object'] }
  }

  if (!isStringArray(json.audience)) {
    errors.push('conditions.json: "audience" must be an array of strings')
  }
  if (!isStringArray(json.output)) {
    errors.push('conditions.json: "output" must be an array of strings')
  }

  const extraDimensions = Object.keys(json).filter(
    (key) => !(CONDITION_DIMENSIONS as readonly string[]).includes(key),
  )
  if (extraDimensions.length > 0) {
    warnings.push(
      `conditions.json: unrecognized dimension(s) ${extraDimensions.join(', ')} — only "audience" and "output" are supported`,
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    value: { audience: json.audience as string[], output: json.output as string[] },
    warnings,
  }
}
