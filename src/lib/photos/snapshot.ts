import { z } from 'zod'
import { loadSnapshot } from '@/lib/snapshot'
import type { PhotoSnapshot } from './types'

/** Cloudinary raw asset written by `npm run sync:photos`. */
const PUBLIC_ID = 'data/photos.json'

/**
 * Mirrors PhotoSnapshot in ./types. Not `strictObject`: a snapshot written by
 * a newer sync may carry fields this build does not know about yet, and
 * refusing to deploy over an extra key would be the wrong call.
 */
const schema: z.ZodType<PhotoSnapshot> = z.object({
  syncedAt: z.string().min(1),
  channel: z.string().min(1),
  photos: z.array(
    z.object({
      id: z.number().int(),
      permalink: z.string().min(1),
      timestamp: z.string().min(1),
      caption: z.string(),
      // Editable, and absent on everything the sync has not been told about.
      alt: z.object({ en: z.string().optional(), uk: z.string().optional() }).default({}),
      hidden: z.boolean().optional(),
      publicId: z.string().min(1),
      width: z.number().positive(),
      height: z.number().positive(),
    })
  ),
})

const EMPTY: PhotoSnapshot = {
  syncedAt: '1970-01-01T00:00:00.000Z',
  channel: 'just_my_photos',
  photos: [],
}

export function loadPhotoSnapshot(): Promise<PhotoSnapshot> {
  return loadSnapshot(PUBLIC_ID, schema, EMPTY)
}
