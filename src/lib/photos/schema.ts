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
      // Optional throughout: a post may have no song, and a song may have no
      // playable file. Both are ordinary states, not a broken snapshot.
      audio: z
        .object({
          id: z.number().int(),
          permalink: z.string().min(1),
          title: z.string(),
          performer: z.string(),
          publicId: z.string().min(1).optional(),
          version: z.number().int().positive().optional(),
          // Non-negative, not positive: Telegram reports duration 0 for a
          // file whose container carries no duration metadata — 6 of the 18
          // songs in this channel. Rejecting 0 failed the whole build over
          // data that is perfectly honest about not knowing.
          duration: z.number().nonnegative().optional(),
        })
        .optional(),
      publicId: z.string().min(1),
      width: z.number().positive(),
      height: z.number().positive(),
      // Cloudinary's version for these bytes. Optional for the same reason as
      // on a Threads image: rows predating the field deliver a versionless URL.
      version: z.number().int().positive().optional(),
    })
  ),
})
