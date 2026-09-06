import type {
  AcceptedDecisionInput,
  CloudDecision,
  MediaDecisionDocument,
  RejectedDecisionInput,
} from '../../shared/decisionTypes'

export function assertWritableDecision(decision: string): asserts decision is CloudDecision {
  if (decision === 'DUPLICATE') {
    throw new Error('DUPLICATE must not be written to Cosmos; keep duplicates local only.')
  }
  if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
    throw new Error(`Unsupported Cosmos decision: ${decision}`)
  }
}

export function buildRejectedDocument(
  userId: string,
  input: RejectedDecisionInput,
): MediaDecisionDocument {
  assertWritableDecision('REJECTED')
  const contentHash = requireHash(input.contentHash)
  return {
    id: contentHash,
    userId: requireUserId(userId),
    contentHash,
    fileSize: requireFileSize(input.fileSize),
    decision: 'REJECTED',
    decidedAt: input.decidedAt ?? new Date().toISOString(),
    cloudStatus: 'NOT_REQUIRED',
  }
}

export function buildAcceptedDocument(
  userId: string,
  input: AcceptedDecisionInput,
): MediaDecisionDocument {
  assertWritableDecision('ACCEPTED')
  const contentHash = requireHash(input.contentHash)
  return {
    id: contentHash,
    userId: requireUserId(userId),
    contentHash,
    fileSize: requireFileSize(input.fileSize),
    decision: 'ACCEPTED',
    decidedAt: input.decidedAt ?? new Date().toISOString(),
    mediaType: input.mediaType,
    originalFilename: input.originalFilename,
    captureDate: input.captureDate,
    organizeDate: input.organizeDate,
    width: input.width,
    height: input.height,
    duration: input.duration,
    tags: input.tags,
    cloudStatus: input.cloudStatus ?? 'PENDING',
    cloudObjectId: null,
  }
}

function requireUserId(userId: string): string {
  if (!userId.trim()) {
    throw new Error('userId (Entra oid) is required as the Cosmos partition key.')
  }
  return userId
}

function requireHash(contentHash: string): string {
  if (!contentHash.trim()) {
    throw new Error('contentHash is required.')
  }
  return contentHash
}

function requireFileSize(fileSize: number): number {
  if (!Number.isFinite(fileSize) || fileSize < 0) {
    throw new Error('fileSize must be a non-negative number.')
  }
  return fileSize
}
