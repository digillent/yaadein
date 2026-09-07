import { extname } from 'node:path'

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

export function mediaTypeFromPath(sourcePath: string): string {
  const extension = extname(sourcePath).toLowerCase()
  return EXTENSION_MEDIA_TYPES[extension] ?? 'application/octet-stream'
}

export function isMediaPath(sourcePath: string): boolean {
  const extension = extname(sourcePath).toLowerCase()
  return Object.prototype.hasOwnProperty.call(EXTENSION_MEDIA_TYPES, extension)
}

export function isLikelyImagePath(sourcePath: string): boolean {
  return mediaTypeFromPath(sourcePath).startsWith('image/')
}
