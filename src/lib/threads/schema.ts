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
  posts: z.array(
    z.object({
      id: z.string().min(1),
      permalink: z.string().min(1),
      timestamp: z.string().min(1),
      mediaType: z.string().min(1),
      text: z.string(),
      images: z.array(imageSchema),
      isQuotePost: z.boolean(),
    })
  ),
}) as z.ZodType<ThreadsSnapshot>
