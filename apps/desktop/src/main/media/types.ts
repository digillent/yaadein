export type MediaTags = {
  people: string[]
  places: string[]
  events: string[]
}

export type MediaInspection = {
  sourcePath: string
  contentHash: string
  fileSize: number
  mediaType: string
  captureDate: string | null
  organizeDate: string
  organizeDateSource: 'user_override' | 'exif' | 'filesystem'
  width: number | null
  height: number | null
  duration: number | null
  tags: MediaTags
  originalFilename: string
}

export function emptyTags(): MediaTags {
  return { people: [], places: [], events: [] }
}
