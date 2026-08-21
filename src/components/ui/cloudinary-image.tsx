import { mediaSrcSet, mediaUrl, widestWidth } from '@/lib/media'

/**
 * An image delivered from Cloudinary.
 *
 * One <img> rather than a <picture> with AVIF and WebP sources: Cloudinary's
 * `f_auto` inspects the Accept header and serves the best format the browser
 * takes, so format negotiation happens at the CDN and there is nothing to
 * enumerate here. Widths still need enumerating — the browser picks from
 * srcSet before any request is made. Explicit width/height prevent layout shift.
 *
 * basePath is intentionally absent. These are absolute URLs on another origin,
 * so the /Personal_WebSite prefix must NOT be applied; passing it would produce
 * https://sergei-butko.github.io/Personal_WebSite/https://res.cloudinary.com/…
 *
 * `sizes` is required rather than defaulted. This renders in four places at
 * four different display sizes, and a wrong `sizes` costs bandwidth silently —
 * the picture still looks right, it is just the wrong file.
 */
export interface CloudinaryAsset {
  /** Cloudinary public id, e.g. "telegram/571-0". Not a URL. */
  publicId: string
  /** Intrinsic size, so the browser can reserve space before loading. */
  width: number
  height: number
}

export function CloudinaryImage({
  asset,
  alt,
  sizes,
  className = '',
  priority = false,
}: {
  asset: CloudinaryAsset
  alt: string
  sizes: string
  className?: string
  priority?: boolean
}) {
  return (
    // next/image is unavailable under output: 'export', and Cloudinary already
    // does the resizing and format negotiation this rule asks for.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(asset.publicId, widestWidth(asset.width))}
      srcSet={mediaSrcSet(asset.publicId, asset.width)}
      sizes={sizes}
      width={asset.width}
      height={asset.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
    />
  )
}
