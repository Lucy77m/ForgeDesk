import path from 'node:path'
import { readJson } from '../storage/json-store.js'
import type { ChangeSession, EvidenceBundle, GitSnapshot } from '../types.js'
import { pathExists } from './workspace.js'

function sortedFiles(files: string[]): string[] {
  return files.map((file) => file.replaceAll('\\', '/')).sort()
}

function sameFiles(left: string[], right: string[]): boolean {
  const normalizedLeft = sortedFiles(left)
  const normalizedRight = sortedFiles(right)
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((file, index) => file === normalizedRight[index])
}

export function sameCapturedDiff(session: ChangeSession, snapshot: GitSnapshot): boolean {
  const captured = session.gitSnapshot
  if (!captured) {
    return false
  }
  if (captured.diffFingerprint && snapshot.diffFingerprint) {
    return captured.diffFingerprint === snapshot.diffFingerprint
  }
  return captured.branch === snapshot.branch &&
    captured.head === snapshot.head &&
    sameFiles(captured.modifiedFiles, snapshot.modifiedFiles) &&
    sameFiles(captured.addedFiles, snapshot.addedFiles) &&
    sameFiles(captured.deletedFiles, snapshot.deletedFiles) &&
    sameFiles(captured.untrackedFiles, snapshot.untrackedFiles)
}

export async function evidenceCurrent(repoPath: string, session: ChangeSession, snapshot: GitSnapshot): Promise<boolean> {
  if (!session.evidenceDir) {
    return false
  }

  const evidenceJson = path.resolve(repoPath, session.evidenceDir, 'evidence.json')
  if (!(await pathExists(evidenceJson))) {
    return false
  }

  try {
    const bundle = await readJson<EvidenceBundle>(evidenceJson)
    if (bundle.generatedAt !== session.updatedAt) {
      return false
    }
    if (bundle.gitSnapshot.diffFingerprint && snapshot.diffFingerprint) {
      return bundle.gitSnapshot.diffFingerprint === snapshot.diffFingerprint
    }
    return sameCapturedDiff(session, snapshot)
  } catch {
    return false
  }
}
