export type ForgeDeskErrorCode =
  | 'GIT_COMMAND_FAILED'
  | 'NO_ACTIVE_SESSION'
  | 'NOT_A_GIT_REPO'
  | 'PROJECT_NOT_FOUND'
  | 'SESSION_NOT_FOUND'

export class ForgeDeskError extends Error {
  constructor(message: string, readonly code?: ForgeDeskErrorCode) {
    super(message)
    this.name = 'ForgeDeskError'
  }
}

export function isForgeDeskError(error: unknown, code?: ForgeDeskErrorCode): error is ForgeDeskError {
  return error instanceof ForgeDeskError && (code === undefined || error.code === code)
}
