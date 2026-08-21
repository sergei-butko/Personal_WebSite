import type { ThreadsImage as ThreadsImageData } from '@/lib/threads/types'
import { mediaSrcSet, mediaUrl, MEDIA_WIDTHS } from '@/lib/media'

/**
 * A Threads image delivered from Cloudinary.
 *
 * One <img>, not a <picture>: Cloudinary's `f_auto` negotiates AVIF/WebP from
 * the Accept header, so there is no format list to enumerate here. Explicit
 * width/height prevents layout shift.
 *
 * No basePath — these are absolute URLs on another origin, and prefixing them
 * with /Personal_WebSite would corrupt them.
 */
export function ThreadsPicture({
  image,
  sizes = '(max-width: 640px) 100vw, 640px',
  priority = false,
}: {
  image: ThreadsImageData
  sizes?: string
  priority?: boolean
}) {
  const widest =
    [...MEDIA_WIDTHS].reverse().find((w) => w <= image.width) ?? MEDIA_WIDTHS[0]

  return (
    // next/image is unavailable under output: 'export', and Cloudinary already
    // does the resizing and format negotiation this rule asks for.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(image.publicId, widest)}
      srcSet={mediaSrcSet(image.publicId, image.width)}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={image.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className="h-auto w-full rounded-xl border border-edge"
    />
  )
}
