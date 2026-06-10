export class ForgeDeskError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForgeDeskError'
  }
}
