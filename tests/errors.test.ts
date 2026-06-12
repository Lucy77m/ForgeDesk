import { describe, expect, it } from 'vitest'
import { ForgeDeskError, isForgeDeskError } from '../src/core/errors.js'

describe('ForgeDeskError', () => {
  it('preserves message text while carrying an internal code', () => {
    const error = new ForgeDeskError('No active change session.', 'NO_ACTIVE_SESSION')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ForgeDeskError')
    expect(error.message).toBe('No active change session.')
    expect(error.code).toBe('NO_ACTIVE_SESSION')
  })

  it('matches ForgeDesk errors by optional code', () => {
    const error = new ForgeDeskError('Unknown session: demo', 'SESSION_NOT_FOUND')

    expect(isForgeDeskError(error)).toBe(true)
    expect(isForgeDeskError(error, 'SESSION_NOT_FOUND')).toBe(true)
    expect(isForgeDeskError(error, 'PROJECT_NOT_FOUND')).toBe(false)
    expect(isForgeDeskError(new Error('Unknown session: demo'), 'SESSION_NOT_FOUND')).toBe(false)
  })
})
