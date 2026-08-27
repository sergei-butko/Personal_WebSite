import { getPlatform } from '@/lib/links/platforms'

/**
 * Brand mark for a platform.
 *
 * The colour is applied via a CSS custom property with a dark-mode override,
 * rather than two elements or a JS theme check — a Server Component cannot
 * know the theme, and the toggle happens without a reload.
 */
export function PlatformIcon({
  platform,
  className = 'h-5 w-5',
  forceColor,
}: {
  platform: string | undefined
  className?: string
  /**
   * Overrides the brand colour — used on brand-coloured backgrounds, and as
   * `currentColor` wherever the mark should be monochrome and inherit the
   * link's own colour, as it does in the footer.
   */
  forceColor?: string
}) {
  const { path, light, dark, label } = getPlatform(platform)

  if (forceColor) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className={`${className} shrink-0`}
        fill={forceColor}
      >
        <title>{label}</title>
        <path d={path} />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`${className} shrink-0 [fill:var(--brand)] dark:[fill:var(--brand-dark)]`}
      style={{ ['--brand' as string]: light, ['--brand-dark' as string]: dark }}
    >
      <title>{label}</title>
      <path d={path} />
    </svg>
  )
}
