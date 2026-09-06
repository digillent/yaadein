import exifr from 'exifr'
import { emptyTags, type MediaTags } from './types'
import { isLikelyImagePath } from './mediaType'

export type ExtractedExifFields = {
  captureDate: Date | null
  width: number | null
  height: number | null
  tags: MediaTags
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pushUnique(target: string[], values: unknown): void {
  const list = Array.isArray(values) ? values : values == null ? [] : [values]
  for (const item of list) {
    if (typeof item !== 'string') {
      continue
    }
    const trimmed = item.trim()
    if (!trimmed) {
      continue
    }
    if (!target.includes(trimmed)) {
      target.push(trimmed)
    }
  }
}

/** Pure helper for tests: map parsed EXIF/IPTC/XMP-ish fields into tags + capture date. */
export function mapParsedExif(parsed: Record<string, unknown> | null | undefined): ExtractedExifFields {
  if (!parsed) {
    return {
      captureDate: null,
      width: null,
      height: null,
      tags: emptyTags(),
    }
  }

  const captureDate =
    asDate(parsed.DateTimeOriginal) ??
    asDate(parsed.CreateDate) ??
    asDate(parsed.DateCreated) ??
    asDate(parsed.ModifyDate) ??
    null

  const width = asNumber(parsed.ExifImageWidth) ?? asNumber(parsed.ImageWidth) ?? null
  const height = asNumber(parsed.ExifImageHeight) ?? asNumber(parsed.ImageHeight) ?? null

  const tags = emptyTags()
  pushUnique(tags.people, parsed.PersonInImage)
  pushUnique(tags.people, parsed.XPAuthor)
  pushUnique(tags.events, parsed.Event)

  // Keywords/subject may mix people, places, and events — keep as people for MVP unless Event set.
  pushUnique(tags.people, parsed.Keywords)
  pushUnique(tags.people, parsed.subject)

  pushUnique(tags.places, parsed.City)
  pushUnique(tags.places, parsed.Country)
  pushUnique(tags.places, parsed.Location)
  pushUnique(tags.places, parsed.SubLocation)

  const latitude = asNumber(parsed.latitude)
  const longitude = asNumber(parsed.longitude)
  if (latitude != null && longitude != null) {
    pushUnique(tags.places, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
  }

  return { captureDate, width, height, tags }
}

export async function extractExifFields(sourcePath: string): Promise<ExtractedExifFields> {
  if (!isLikelyImagePath(sourcePath)) {
    return {
      captureDate: null,
      width: null,
      height: null,
      tags: emptyTags(),
    }
  }

  try {
    const parsed = (await exifr.parse(sourcePath, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'DateCreated',
        'ModifyDate',
        'ImageWidth',
        'ImageHeight',
        'ExifImageWidth',
        'ExifImageHeight',
        'latitude',
        'longitude',
        'Keywords',
        'subject',
        'PersonInImage',
        'XPAuthor',
        'Event',
        'City',
        'Country',
        'Location',
        'SubLocation',
      ],
      iptc: true,
      xmp: true,
      gps: true,
    })) as Record<string, unknown> | undefined

    return mapParsedExif(parsed)
  } catch {
    return {
      captureDate: null,
      width: null,
      height: null,
      tags: emptyTags(),
    }
  }
}
