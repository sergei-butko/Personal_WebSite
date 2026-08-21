import type { PhotoSnapshot } from '@/lib/photos'

/**
 * GENERATED FILE — do not edit by hand.
 * Written by `npm run sync:photos`, and committed deliberately.
 *
 * publicId is a Cloudinary id, not a path. The image bytes live in Cloudinary;
 * this file is the only thing about them that is in git.
 *
 * Deliberately EMPTY as of the Cloudinary migration. The previous snapshot
 * pointed at 400 files under public/images/photos/, all of which this change
 * deletes. It is not rewritten to Cloudinary ids by hand, because the sync
 * treats "id present in this snapshot" as "already uploaded" — hand-written
 * ids would name assets that do not exist yet and the sync would skip them
 * forever. An empty snapshot makes the first run upload everything, which is
 * the only self-correcting option.
 *
 * The gallery renders its empty state until that first run. Run the sync
 * against the branch BEFORE merging so main never sees it — see
 * docs/RUNBOOK-CLOUDINARY.md.
 *
 * Hand edits belong in photo-meta.ts, which the sync never touches.
 */
export const photoSnapshot: PhotoSnapshot = {
  "syncedAt": "1970-01-01T00:00:00.000Z",
  "channel": "just_my_photos",
  "photos": []
}
