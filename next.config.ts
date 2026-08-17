import type { NextConfig } from 'next'

/**
 * Served from https://sergei-butko.github.io/Personal_WebSite/ , so every URL
 * needs that prefix. Kept in an env var rather than hardcoded: moving to a
 * custom domain later means setting this to '' in the workflow, not editing code.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  // Static export — a plain folder of HTML/CSS/JS in ./out.
  output: 'export',

  // Emits /blog/index.html rather than /blog.html, so GitHub Pages serves
  // clean URLs without any server-side rewrite.
  trailingSlash: true,

  basePath,
  assetPrefix: basePath || undefined,

  // next/image optimisation needs a server; a static export has none.
  // Phase 4 ships pre-sized AVIF/WebP from the photo pipeline instead.
  images: { unoptimized: true },

  reactStrictMode: true,

  env: { NEXT_PUBLIC_BASE_PATH: basePath },
}

export default nextConfig
