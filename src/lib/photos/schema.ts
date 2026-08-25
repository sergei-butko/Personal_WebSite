import { z } from 'zod'
import type { PhotoSnapshot } from './types'

/**
 * The shape of data/photos.json.
 *
 * Deliberately in its own module, importing nothing but types: the site's
 * loader validates with it at build time, and `npm run content:push` validates
 * with it before uploading. One definition, so a hand edit cannot pass the
 * push and then fail the build.
 */
/**
 * Mirrors PhotoSnapshot in ./types. Not `strictObject`: a snapshot written by
 * a newer sync may carry fields this build does not know about yet, and
 * refusing to deploy over an extra key would be the wrong call.
 */
export const photoSnapshotSchema: z.ZodType<PhotoSnapshot> = z.object({
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
