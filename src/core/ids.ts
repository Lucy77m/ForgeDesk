export function nowIso(): string {
  return new Date().toISOString()
}

export function timestampPrefix(): string {
  return nowIso().replace(/[-:TZ.]/g, '').slice(0, 14)
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function makeId(label: string, fallback = 'session'): string {
  const slug = slugify(label) || slugify(fallback) || 'session'
  return `${timestampPrefix()}-${slug}-${randomSuffix()}`
}

export function makeTestId(): string {
  return `test-${timestampPrefix()}-${randomSuffix()}`
}
