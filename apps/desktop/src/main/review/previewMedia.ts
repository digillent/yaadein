import type { MediaPreview } from '../../shared/reviewTypes'
import { buildLocalMediaPreview } from '../../shared/buildLocalMediaPreview'

/**
 * Preview metadata for IPC callers. Stream URL only (no base64) so large libraries
 * and ←/→ review stay responsive.
 */
export async function buildMediaPreview(sourcePath: string): Promise<MediaPreview> {
  return buildLocalMediaPreview(sourcePath)
}
