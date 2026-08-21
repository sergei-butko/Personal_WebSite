/**
 * The "is this image already stored?" decision, kept pure so it can be tested
 * without a network, a Cloudinary account, or a Telegram page.
 *
 * Distinctness is by sha256 of the file bytes. It cannot be by URL: Telegram's
 * CDN URLs are signed and differ per fetch for identical images, which is what
 * made the first implementation store thirteen copies of everything.
 */

export interface StoredSize {
  width: number
  height: number
}

export type DedupDecision =
  | { kind: 'reuse'; publicId: string; width: number; height: number }
  | { kind: 'upload'; reason: 'new' | 'same-id' | 'no-dimensions' }

/**
 * @param hash        sha256 of the image bytes
 * @param publicId    the id this photo would be uploaded under
 * @param hashes      known hash → public id, from the committed map
 * @param dimensions  known public id → size, from the committed snapshot
 */
export function decideAsset(
  hash: string,
  publicId: string,
  hashes: ReadonlyMap<string, string>,
  dimensions: ReadonlyMap<string, StoredSize>
): DedupDecision {
  const existing = hashes.get(hash)

  if (!existing) return { kind: 'upload', reason: 'new' }

  // The same photo in the same slot: not a duplicate, just this photo again.
  // Uploading overwrites in place, which is harmless and keeps the asset warm.
  if (existing === publicId) return { kind: 'upload', reason: 'same-id' }

  const size = dimensions.get(existing)

  // A hash pointing at an asset whose size we do not know — a map entry that
  // outlived its snapshot entry. Guessing dimensions would ship a wrong
  // width/height and shift the grid, so upload instead.
  if (!size) return { kind: 'upload', reason: 'no-dimensions' }

  return { kind: 'reuse', publicId: existing, width: size.width, height: size.height }
}
