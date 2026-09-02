import { z } from 'zod'
import type { ThreadsSnapshot } from './types'

/**
 * The shape of data/threads.json.
 *
 * Deliberately in its own module, importing nothing but types: the site's
 * loader validates with it at build time, and `npm run content:push` validates
 * with it before uploading. One definition, so a hand edit cannot pass the
 * push and then fail the build.
 */
/**
 * Mirrors ThreadsSnapshot in ./types. Not `strictObject`: a snapshot written
 * by a newer sync may carry fields this build does not know about yet, and
 * refusing to deploy over an extra key would be the wrong call.
 *
 * mediaType is a plain string rather than an enum. Meta has added values
 * before (REPOST_FACADE, AUDIO) and a new one arriving should render as an
 * ordinary post, not fail the build.
 */
const imageSchema = z.object({
  publicId: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  alt: z.string(),
})

export const threadsSnapshotSchema: z.ZodType<ThreadsSnapshot> = z.object({
  syncedAt: z.string().min(1),
  username: z.string().min(1),
  // Optional: snapshots written before this field existed do not carry it, and
  // the sync derives and backfills it on the next run.
  syncedThrough: z.string().min(1).optional(),
  posts: z.array(
    z.object({
      id: z.string().min(1),
      permalink: z.string().min(1),
      timestamp: z.string().min(1),
      mediaType: z.string().min(1),
      text: z.string(),
      images: z.array(imageSchema),
      isQuotePost: z.boolean(),
      // Hand-written and optional. Both halves required together when present:
      // a brand with no scent, or the reverse, is a half-finished edit rather
      // than a meaningful state, and catching it here beats rendering it.
      // `collection` is the exception to that pairing: a house without lines
      // has none to give, so it is optional on its own terms.
      fragrance: z
        .object({
          brand: z.string().min(1),
          collection: z.string().min(1).optional(),
          name: z.string().min(1),
        })
        .optional(),
    })
  ),
}) as z.ZodType<ThreadsSnapshot>
