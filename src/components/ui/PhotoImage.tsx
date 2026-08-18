import type { Photo } from '@/lib/photos'

function srcSet(variants: { src: string; width: number }[], basePath: string): string {
  return variants.map((v) => `${basePath}${v.src} ${v.width}w`).join(', ')
}

/**
 * Plain <picture>: the static export has no image optimiser, and the sync has
 * already produced correctly-sized AVIF and WebP. Explicit width/height keeps
 * the grid from shifting as images load.
 */
export function PhotoImage({
  photo,
  alt,
  basePath,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px',
  className = '',
  priority = false,
}: {
  photo: Photo
  alt: string
  basePath: string
  sizes?: string
  className?: string
  priority?: boolean
}) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(photo.avif, basePath)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(photo.webp, basePath)} sizes={sizes} />
      <img
        src={`${basePath}${photo.src}`}
        width={photo.width}
        height={photo.height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={className}
      />
    </picture>
  )
}
