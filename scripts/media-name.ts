/**
 * Where every Cloudinary asset lives, and what it is called.
 *
 * Two different things share this file because they must not drift apart: the
 * syncs write new assets here, and `organise-media.ts` moves existing ones to
 * the same place. When those disagreed, a sync quietly re-created the old
 * layout underneath the new one.
 *
 * ## Folders are not public id prefixes
 *
 * This cloud is in Cloudinary's DYNAMIC FOLDER mode, where an asset carries an
 * `asset_folder` that is independent of its `public_id`. The Media Library
 * groups by `asset_folder`; the delivery URL is built from `public_id`.
 *
 * Both are set, to the same string. `cloudinary.ts` derives the folder from the
 * id at UPLOAD time, so anything the syncs write is filed as it arrives; that
 * was not always true, and two images from a post synced on 2026-09-01 landed
 * in the root of the Media Library because of it.
 *
 * Do not assume that RENAMING an asset moves it — that one is still true.
 * `uploader.rename` leaves `asset_folder` alone, and `uploader.explicit` is
 * what `organise-media.ts` uses to repair a folder after the fact.
 */

import type { Fragrance } from '../src/lib/threads/types'

/** Telegram photos. */
export const TELEGRAM_IMAGE_FOLDER =
  process.env.TELEGRAM_MEDIA_FOLDER ?? 'telegram/images'

/** Telegram songs. Cloudinary files audio as a `video` resource. */
export const TELEGRAM_AUDIO_FOLDER = process.env.TELEGRAM_AUDIO_FOLDER ?? 'telegram/audio'

/** Threads images. */
export const THREADS_IMAGE_FOLDER = process.env.THREADS_MEDIA_FOLDER ?? 'threads/images'

/** The JSON snapshots, stored as `raw` assets. */
export const DATA_FOLDER = 'data'

/**
 * One field of a file name: a brand, or a scent.
 *
 * `-` separates the fields of a name and therefore may never appear inside
 * one, so this emits `[A-Za-z0-9_]` and nothing else. "Marc-Antoine Barrois"
 * becomes `Marc_Antoine_Barrois`, not `Marc-Antoine_Barrois`, which would put
 * a field separator in the middle of a house.
 *
 * Diacritics are folded rather than stripped — `Wūlóng Chá` is `Wulong_Cha`,
 * `Ombré Leather` is `Ombre_Leather`, `Hermès` is `Hermes`. Eleven of the
 * names in this archive carry them, and a percent-encoded public id defeats
 * the point of a readable one.
 *
 * Apostrophes are DELETED rather than replaced, because `Sister's Aroma` reads
 * as `Sisters_Aroma` and not `Sister_s_Aroma`. Everything else that is not a
 * letter or a digit becomes `_`, runs collapse, and the ends are trimmed:
 * `Bleu de Chanel (EDP)` is `Bleu_de_Chanel_EDP`.
 *
 * Returns '' for a name with no ASCII-representable characters at all — a
 * Cyrillic house, say. Callers must treat that as "cannot name this" and fall
 * back to the source id rather than emitting a file called `_`.
 */
export function slugPart(value: string): string {
  return (
    value
      .normalize('NFD')
      // Combining marks, i.e. the accents NFD just split off. Written as escapes
      // rather than as the characters themselves — they are invisible in an
      // editor and a stray one inside the class would be impossible to spot.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  )
}

/**
 * The public id for one Threads image.
 *
 * `<folder>/<Brand>-<Scent>-<n>`, n counting from 1, because a file called
 * `Tom_Ford-Oud_Wood-1` says what it is and `threads/17956459470243614-0` does
 * not. That is the whole reason this exists: the Media Library is browsed by a
 * human looking for a bottle.
 *
 * ## Why the fallback is not a detail
 *
 * The fragrance is HAND-WRITTEN and is absent at capture time — always. The
 * sync learns of a post the moment it is published, and which bottle it
 * reviews is a judgement Serhii makes afterwards through `content:pull` /
 * `content:push`. So a freshly synced post has no brand and no scent, and this
 * returns the id-shaped name for it.
 *
 * That is why renaming is a separate, idempotent pass (`npm run media:organise`)
 * rather than something the sync does: at upload time there is nothing to name
 * the file after. Run it after naming bottles, and the id-shaped leftovers
 * become readable ones.
 */
export function threadsImageId(
  fragrance: Fragrance | undefined,
  postId: string,
  index: number
): string {
  const brand = slugPart(fragrance?.brand ?? '')
  const name = slugPart(fragrance?.name ?? '')
  if (!brand || !name) return `${THREADS_IMAGE_FOLDER}/${postId}-${index}`
  return `${THREADS_IMAGE_FOLDER}/${brand}-${name}-${index + 1}`
}

/** The public id for one Telegram photo. Keyed on the message id and slot. */
export function telegramImageId(postId: number, index: number): string {
  return `${TELEGRAM_IMAGE_FOLDER}/${postId}-${index}`
}

/** The public id for one Telegram song, keyed on the AUDIO post's message id. */
export function telegramAudioId(audioPostId: number): string {
  return `${TELEGRAM_AUDIO_FOLDER}/${audioPostId}`
}

/** The folder an asset belongs in, from its public id. */
export function folderOf(publicId: string): string {
  const cut = publicId.lastIndexOf('/')
  return cut === -1 ? '' : publicId.slice(0, cut)
}

/** The last segment of a public id — what the Media Library shows as a name. */
export function displayNameOf(publicId: string): string {
  const cut = publicId.lastIndexOf('/')
  return cut === -1 ? publicId : publicId.slice(cut + 1)
}
