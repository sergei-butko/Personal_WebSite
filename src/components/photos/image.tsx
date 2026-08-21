import type { Photo } from '@/lib/photos/types'
import { mediaSrcSet, mediaUrl, MEDIA_WIDTHS } from '@/lib/media'

/**
 * A photo delivered from Cloudinary.
 *
 * One <img> rather than a <picture> with AVIF and WebP sources: Cloudinary's
 * `f_auto` inspects the Accept header and serves the best format the browser
 * takes, so format negotiation happens at the CDN and there is nothing to
 * enumerate here. Widths still need enumerating — the browser picks from
 * srcSet before any request is made.
 *
 * basePath is intentionally absent. These are absolute URLs on another origin,
 * so the /Personal_WebSite prefix must NOT be applied; passing it would
 * produce https://sergei-butko.github.io/Personal_WebSite/https://res.cloud...
 */
export function PhotoImage({
  photo,
  alt,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px',
  className = '',
  priority = false,
}: {
  photo: Photo
  alt: string
  sizes?: string
  className?: string
  priority?: boolean
}) {
  const widest =
    [...MEDIA_WIDTHS].reverse().find((w) => w <= photo.width) ?? MEDIA_WIDTHS[0]

  return (
    // next/image is unavailable under output: 'export', and Cloudinary already
    // does the resizing and format negotiation this rule asks for.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(photo.publicId, widest)}
      srcSet={mediaSrcSet(photo.publicId, photo.width)}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
    />
  )
}
