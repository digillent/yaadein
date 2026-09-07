/**
 * Parse YYYY/MM from a cleanup-relative path like `2026/01/photo.jpg`.
 */
export function yearMonthFromCleanupRelativePath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/')
  const match = /^(\d{4}\/\d{2})(?:\/|$)/.exec(normalized)
  return match?.[1] ?? null
}
