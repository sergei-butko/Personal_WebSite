import type { ThreadsImage as ThreadsImageData } from '@/lib/threads'

function srcSet(variants: { src: string; width: number }[], basePath: string): string {
  return variants.map((v) => `${basePath}${v.src} ${v.width}w`).join(', ')
}

/**
 * Plain <picture> rather than next/image: the static export has no image
 * optimiser, and the sync script has already produced correctly-sized AVIF
 * and WebP. Explicit width/height prevents layout shift.
 *
 * basePath must be passed in — this is a server component rendered inside a
 * static export, and raw <img> src values are not prefixed automatically.
 */
export function ThreadsPicture({
  image,
  basePath,
  sizes = '(max-width: 640px) 100vw, 640px',
  priority = false,
}: {
  image: ThreadsImageData
  basePath: string
  sizes?: string
  priority?: boolean
}) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(image.avif, basePath)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(image.webp, basePath)} sizes={sizes} />
      <img
        src={`${basePath}${image.src}`}
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="h-auto w-full rounded-xl border border-edge"
      />
    </picture>
  )
}
