/**
 * Externally-hosted media.
 *
 * Images live in Cloudinary, not in git. Everything that builds a media URL
 * goes through here, so swapping provider later — to R2, or back to local
 * files — is one module rather than a search across components.
 *
 * Cloudinary does the resizing and format negotiation on its own CDN, which
 * is why there is no sharp pipeline for uploaded content: `f_auto` serves
 * AVIF to browsers that take it and WebP to the rest, and `q_auto` picks a
 * quality per image rather than a blanket number.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? ''

/** Widths generated for srcset. Cloudinary makes these on demand. */
const MEDIA_WIDTHS = [400, 800, 1200, 1600] as const

/**
 * The `v<version>` segment, or '' when the snapshot has no version recorded.
 *
 * ## Why a URL carries a version at all
 *
 * A public id here is POSITIONAL — `<Brand>-<Scent>-<n>`, where n is the
 * image's index in its post — so reordering a post's pictures does not rename
 * anything, it swaps the bytes underneath two stable ids. Cloudinary serves
 * those with `cache-control: max-age=2592000`, so every browser that had
 * loaded the page went on showing the old order for up to thirty days. That
 * happened on 2026-09-02 and took a hard refresh to see past.
 *
 * The version changes on every write to an asset, so putting it in the path
 * gives replaced bytes a URL of their own. This is Cloudinary's own convention
 * and the reason their SDKs emit it by default.
 *
 * Absent is a supported state, not a gap: a snapshot written before the field
 * existed carries none, and the versionless URL still resolves — to whatever
 * the asset holds now, which is exactly the behaviour we had before. So this
 * degrades to the old URL rather than to a broken one.
 */
function versionPath(version: number | undefined): string {
  return version ? `v${version}/` : ''
}

/**
 * Fails the build when content needs Cloudinary and the cloud name is absent.
 *
 * The previous version of this module returned '' for every URL when the env
 * var was unset. That is exactly the failure this repo avoids everywhere else:
 * it produces a site that builds green and ships 400 broken images. Callers
 * that hold real content call this first, so a missing var stops CI instead.
 */
function assertConfigured(context: string): void {
  if (CLOUD_NAME) return
  throw new Error(
    `NEXT_PUBLIC_CLOUDINARY_CLOUD is not set, but ${context} needs it to build ` +
      `image URLs. Set it in the environment (deploy.yml sets it in CI) or the ` +
      `build would emit empty src attributes.`
  )
}

/**
 * A delivery URL at a given width.
 *
 * f_auto negotiates AVIF/WebP per browser and q_auto picks quality per image,
 * so there is no local encoding step and no variant files. c_limit never
 * upscales past the original.
 */
export function mediaUrl(publicId: string, width: number, version?: number): string {
  assertConfigured(`the image "${publicId}"`)
  const transform = `f_auto,q_auto,c_limit,w_${width}`
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${versionPath(version)}${encodeURI(publicId)}`
}

/**
 * A delivery URL for an audio file.
 *
 * /video/upload/, not /audio/: Cloudinary has no audio resource type and
 * stores every sound as a video. The .mp3 extension asks the CDN to transcode
 * on delivery, so whatever Telegram was holding — m4a, ogg, flac — arrives as
 * something every browser can play, and the player needs no per-file format
 * handling. The first request for a track pays for the transcode; the CDN
 * serves the rest.
 */
export function audioUrl(publicId: string, version?: number): string {
  assertConfigured(`the audio file "${publicId}"`)
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${versionPath(version)}${encodeURI(publicId)}.mp3`
}

export function mediaSrcSet(
  publicId: string,
  intrinsicWidth: number,
  version?: number
): string {
  return MEDIA_WIDTHS.filter((w) => w <= intrinsicWidth)
    .map((w) => `${mediaUrl(publicId, w, version)} ${w}w`)
    .join(', ')
}

/**
 * The largest generated width that does not exceed the original.
 *
 * Every `src` attribute needs this, and it was written out three times — once
 * per image component and once here — before being pulled into one place. The
 * `c_limit` transform means asking for more than the original just returns the
 * original, so this is about not lying in the URL rather than about correctness.
 */
export function widestWidth(intrinsicWidth: number): number {
  return [...MEDIA_WIDTHS].reverse().find((w) => w <= intrinsicWidth) ?? MEDIA_WIDTHS[0]
}
