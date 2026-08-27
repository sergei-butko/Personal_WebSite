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
export function mediaUrl(publicId: string, width: number): string {
  assertConfigured(`the image "${publicId}"`)
  const transform = `f_auto,q_auto,c_limit,w_${width}`
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${encodeURI(publicId)}`
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
export function audioUrl(publicId: string): string {
  assertConfigured(`the audio file "${publicId}"`)
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${encodeURI(publicId)}.mp3`
}

export function mediaSrcSet(publicId: string, intrinsicWidth: number): string {
  return MEDIA_WIDTHS.filter((w) => w <= intrinsicWidth)
    .map((w) => `${mediaUrl(publicId, w)} ${w}w`)
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
