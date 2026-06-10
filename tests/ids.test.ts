import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeId, makeTestId, nowIso, slugify, timestampPrefix } from '../src/core/ids.js'

describe('ids', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('formats timestamps consistently', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T01:02:03.456Z'))

    expect(nowIso()).toBe('2026-06-11T01:02:03.456Z')
    expect(timestampPrefix()).toBe('20260611010203')
  })

  it('slugifies labels for ids', () => {
    expect(slugify(' My Fancy Change! ')).toBe('my-fancy-change')
    expect(slugify('***')).toBe('')
    expect(slugify('abcdefghijklmnopqrstuvwxyz1234567890-extra')).toBe('abcdefghijklmnopqrstuvwxyz1234567890-ext')
  })

  it('builds readable session and test ids', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T01:02:03.456Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

    expect(makeId('My Fancy Change!')).toBe('20260611010203-my-fancy-change-4fzzzx')
    expect(makeId('***')).toBe('20260611010203-session-4fzzzx')
    expect(makeTestId()).toBe('test-20260611010203-4fzzzx')
  })
})
