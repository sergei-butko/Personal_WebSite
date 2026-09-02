/**
 * What "consistent" means for the media store, as a pure function.
 *
 * Separated from `verify-media.ts` the same way `threads-merge.ts` is
 * separated from the sync: the rule is the part worth pinning, and pinning it
 * must not need a Cloudinary account, a network or a key. `npm run
 * test:media-audit` runs the four cases below against synthetic input.
 */

import type { AssetRow, ResourceType } from './cloudinary'
import {
  TELEGRAM_AUDIO_FOLDER,
  TELEGRAM_IMAGE_FOLDER,
  THREADS_IMAGE_FOLDER,
  folderOf,
} from './media-name'
import type { PhotoSnapshot } from '../src/lib/photos/types'
import type { ThreadsSnapshot } from '../src/lib/threads/types'

/** The namespaces the syncs own. Nothing outside them is this script's business. */
const MANAGED = [TELEGRAM_IMAGE_FOLDER, TELEGRAM_AUDIO_FOLDER, THREADS_IMAGE_FOLDER]

/** One thing a snapshot points at, and enough context to find the row again. */
export interface Reference {
  publicId: string
  resourceType: ResourceType
  /** How the report names it, e.g. "Tom Ford – Oud Wood, image 2". */
  where: string
}

export function threadsReferences(snapshot: ThreadsSnapshot): Reference[] {
  return snapshot.posts.flatMap((post) =>
    post.images.map((image, index) => ({
      publicId: image.publicId,
      resourceType: 'image' as const,
      where: post.fragrance
        ? `${post.fragrance.brand} – ${post.fragrance.name}, image ${index + 1}`
        : `post ${post.id}, image ${index + 1}`,
    }))
  )
}

export function photoReferences(snapshot: PhotoSnapshot): Reference[] {
  const refs: Reference[] = []
  for (const photo of snapshot.photos) {
    refs.push({
      publicId: photo.publicId,
      resourceType: 'image',
      // Photos carry no title, so the message id is the only handle there is.
      where: `photo ${photo.publicId}`,
    })
    // A track the sync could not fetch has a title and no publicId, which is a
    // supported state — the card links to Telegram and the player is absent.
    if (photo.audio?.publicId) {
      refs.push({
        publicId: photo.audio.publicId,
        resourceType: 'video',
        where: `song "${photo.audio.title ?? photo.audio.publicId}"`,
      })
    }
  }
  return refs
}

/** Whether a public id sits under one of the namespaces the syncs own. */
function isManaged(publicId: string): boolean {
  return MANAGED.some((prefix) => publicId.startsWith(`${prefix}/`))
}

/**
 * An asset plus the resource type it was listed under. Carried rather than
 * inferred: audio lives under `video`, and `telegram/audio/554` is
 * indistinguishable from an image by its name alone.
 */
export type TypedAsset = AssetRow & { resourceType: ResourceType }

export interface Report {
  /** A row points at an id that is not in the store. The page breaks. */
  missing: Array<Reference>
  /**
   * An asset filed in a managed FOLDER whose public id is not in the managed
   * namespace — the Media Library hand-upload, sitting there unreachable.
   */
  stranded: TypedAsset[]
  /** In the namespace, referenced by nothing. Storage, not breakage. */
  orphaned: string[]
  /** Id and folder disagree. Cosmetic in the Media Library; media:organise fixes it. */
  misfiled: TypedAsset[]
}

export function inspect(references: Reference[], assets: TypedAsset[]): Report {
  const present = new Set(assets.map((a) => `${a.resourceType}:${a.publicId}`))
  const referenced = new Set(references.map((r) => `${r.resourceType}:${r.publicId}`))

  return {
    missing: references.filter((r) => !present.has(`${r.resourceType}:${r.publicId}`)),
    stranded: assets.filter(
      (a) => !isManaged(a.publicId) && MANAGED.some((m) => a.assetFolder === m)
    ),
    orphaned: assets
      .filter(
        (a) => isManaged(a.publicId) && !referenced.has(`${a.resourceType}:${a.publicId}`)
      )
      .map((a) => a.publicId),
    misfiled: assets.filter(
      (a) => isManaged(a.publicId) && a.assetFolder !== folderOf(a.publicId)
    ),
  }
}
