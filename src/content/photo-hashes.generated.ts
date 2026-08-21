/**
 * GENERATED FILE — do not edit by hand.
 * Written by `npm run sync:photos`, and committed deliberately.
 *
 * Maps the sha256 of an image's bytes to the Cloudinary public id it was
 * first stored under. This is what makes the sync store DISTINCT images: the
 * same photo posted twice to the channel gets two entries in the snapshot —
 * both posts are real and both should appear — but only one asset.
 *
 * Kept out of photos.generated.ts on purpose. Content hashes are a concern of
 * the sync, not of the site, and nothing under src/lib or src/components ever
 * reads this.
 *
 * Empty until the first run that hashes the channel. Photos uploaded before
 * this existed are already in Cloudinary under their own ids and stay there
 * until a `SYNC_FORCE=1` run re-hashes everything.
 */
export const photoHashes: Record<string, string> = {}
