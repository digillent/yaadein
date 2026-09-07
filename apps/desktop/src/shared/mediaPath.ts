/** Extension → MIME for previewable photo/video keepers. */
const EXTENSION_MEDIA_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
}

function extensionOf(sourcePath: string): string {
  const base = sourcePath.split(/[/\\]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) {
    return ''
  }
  return base.slice(dot).toLowerCase()
}

export function mediaTypeFromPath(sourcePath: string): string {
  return EXTENSION_MEDIA_TYPES[extensionOf(sourcePath)] ?? 'application/octet-stream'
}

/** True for extensions we can preview/review (excludes .DS_Store, .txt, etc.). */
export function isMediaPath(sourcePath: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXTENSION_MEDIA_TYPES, extensionOf(sourcePath))
}

export function isLikelyImagePath(sourcePath: string): boolean {
  return mediaTypeFromPath(sourcePath).startsWith('image/')
}

export function isLikelyVideoPath(sourcePath: string): boolean {
  return mediaTypeFromPath(sourcePath).startsWith('video/')
}
