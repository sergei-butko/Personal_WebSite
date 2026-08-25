import { loadSnapshot } from '@/lib/snapshot'
import { photoSnapshotSchema } from './schema'
import type { PhotoSnapshot } from './types'

/** Cloudinary raw asset written by `npm run sync:photos`. */
const PUBLIC_ID = 'data/photos.json'

const EMPTY: PhotoSnapshot = {
  syncedAt: '1970-01-01T00:00:00.000Z',
  channel: 'just_my_photos',
  photos: [],
}

export function loadPhotoSnapshot(): Promise<PhotoSnapshot> {
  return loadSnapshot(PUBLIC_ID, photoSnapshotSchema, EMPTY)
}
