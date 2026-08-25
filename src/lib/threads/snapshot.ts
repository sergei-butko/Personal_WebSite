import { z } from 'zod'
import { loadSnapshot } from '@/lib/snapshot'
import type { ThreadsSnapshot } from './types'

/** Cloudinary raw asset written by `npm run sync:threads`. */
const PUBLIC_ID = 'data/threads.json'

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

const schema: z.ZodType<ThreadsSnapshot> = z.object({
  syncedAt: z.string().min(1),
  username: z.string().min(1),
  posts: z.array(
    z.object({
      id: z.string().min(1),
      permalink: z.string().min(1),
      timestamp: z.string().min(1),
      mediaType: z.string().min(1),
      text: z.string(),
      images: z.array(
        z.object({
          publicId: z.string().min(1),
          width: z.number().positive(),
          height: z.number().positive(),
          alt: z.string(),
        })
      ),
      isQuotePost: z.boolean(),
      hasReplies: z.boolean(),
      // Absent on most posts: only two-part reviews carry one.
      followUp: z
        .object({
          id: z.string().min(1),
          timestamp: z.string().min(1),
          text: z.string(),
          images: z.array(imageSchema),
        })
        .optional(),
    })
  ),
}) as z.ZodType<ThreadsSnapshot>

const EMPTY: ThreadsSnapshot = {
  syncedAt: '1970-01-01T00:00:00.000Z',
  username: 'sergei_butko',
  posts: [],
}

export function loadThreadsSnapshot(): Promise<ThreadsSnapshot> {
  return loadSnapshot(PUBLIC_ID, schema, EMPTY)
}
