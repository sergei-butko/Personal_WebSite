/**
 * next/link and next/image prefix basePath automatically. Anything that
 * builds a URL by hand — window.location, raw <a>, metadata — does not,
 * so it must go through here.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function withBase(path: string): string {
  return `${basePath}${path}`
}
