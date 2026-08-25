import { loadSnapshot } from '@/lib/snapshot'
import { threadsSnapshotSchema } from './schema'
import type { ThreadsSnapshot } from './types'

/** Cloudinary raw asset written by `npm run sync:threads`. */
const PUBLIC_ID = 'data/threads.json'

const EMPTY: ThreadsSnapshot = {
  syncedAt: '1970-01-01T00:00:00.000Z',
  username: 'sergei_butko',
  posts: [],
}

export function loadThreadsSnapshot(): Promise<ThreadsSnapshot> {
  return loadSnapshot(PUBLIC_ID, threadsSnapshotSchema, EMPTY)
}
