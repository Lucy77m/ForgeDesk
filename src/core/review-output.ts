import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ChangeSession } from '../types.js'
import { ForgeDeskError } from './errors.js'
import { pathExists, resolveSession } from './workspace.js'

export type ReviewOutputKind = 'review-context' | 'pr'

export type ReviewOutput = {
  kind: ReviewOutputKind
  fileName: 'REVIEW_CONTEXT.md' | 'PR_BODY.md'
  session: {
    id: string
    title: string
    status: ChangeSession['status']
  }
  text: string
}

export type ReviewOutputOptions = {
  sessionId?: string
  kind: ReviewOutputKind
}

function fileNameFor(kind: ReviewOutputKind): ReviewOutput['fileName'] {
  return kind === 'review-context' ? 'REVIEW_CONTEXT.md' : 'PR_BODY.md'
}

function labelFor(kind: ReviewOutputKind): string {
  return kind === 'review-context' ? 'review context' : 'PR body'
}

function missingEvidenceMessage(kind: ReviewOutputKind): string {
  return `Cannot read ${labelFor(kind)} because evidence has not been generated. Run "forgedesk auto --no-run" or "forgedesk evidence" first.`
}

export async function getReviewOutput(cwd: string, options: ReviewOutputOptions): Promise<ReviewOutput> {
  const { workspace, session } = await resolveSession(cwd, options.sessionId)
  if (!session.evidenceDir) {
    throw new ForgeDeskError(missingEvidenceMessage(options.kind))
  }

  const fileName = fileNameFor(options.kind)
  const filePath = path.resolve(workspace.repoPath, session.evidenceDir, fileName)
  if (!(await pathExists(filePath))) {
    throw new ForgeDeskError(`Cannot read ${labelFor(options.kind)} because ${fileName} is missing. Run "forgedesk auto --no-run" or "forgedesk evidence" first.`)
  }

  return {
    kind: options.kind,
    fileName,
    session: {
      id: session.id,
      title: session.title,
      status: session.status
    },
    text: await readFile(filePath, 'utf8')
  }
}
