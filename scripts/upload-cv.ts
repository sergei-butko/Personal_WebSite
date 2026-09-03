/**
 * Puts the CV PDF in Cloudinary and prints the version to record.
 *
 *     npm run cv:upload -- docs/CV_Serhii_Butko_2025.pdf
 *
 * ## Why this is not a committed file
 *
 * The same rule the photographs follow: bytes live in Cloudinary, the repo
 * holds ids. A CV is a few megabytes of scan-quality render that changes once
 * or twice a year, and every revision of it would stay in git history forever.
 *
 * ## Why the public id is stable and the version is not
 *
 * `docs/cv-serhii-butko.pdf` is the id for every revision — replacing the document
 * replaces the bytes underneath it, so no link anywhere ever goes stale. But
 * raw assets are served with the same long max-age as images, so a visitor who
 * downloaded last year's copy would go on being handed it. The version segment
 * is what gives the new document a URL of its own, which is why this prints it
 * and why `content/cv.ts` records it.
 *
 * The extension is part of the id on purpose. A raw asset is served as
 * `application/octet-stream` with `content-disposition: attachment` naming the
 * id — so an id without `.pdf` hands the visitor a file called
 * `cv-serhii-butko` that their machine does not know how to open. Cloudinary
 * derives both the type and the filename from the id's extension.
 *
 * The upload is `overwrite` + `invalidate`, and then waits until the CDN
 * actually serves the new bytes — raw delivery on this account is eventually
 * consistent, measured at about four seconds, and reporting success before
 * then is how a deploy publishes the previous document.
 */

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { configureCloudinary, cloudName } from './cloudinary'

const PUBLIC_ID = 'docs/cv-serhii-butko.pdf'
const DEFAULT_SOURCE = 'docs/CV_Serhii_Butko_2025.pdf'

/** Cloudinary's raw upload cap on the free plan. */
const MAX_BYTES = 10 * 1024 * 1024

async function main(): Promise<void> {
  const source = process.argv[2] ?? DEFAULT_SOURCE

  const bytes = await readFile(source).catch(() => {
    throw new Error(
      `Cannot read ${source}. Pass the PDF as an argument, or put it at ${DEFAULT_SOURCE}.`
    )
  })

  if (!basename(source).toLowerCase().endsWith('.pdf')) {
    throw new Error(`${source} is not a PDF. The CV tile links to it as one.`)
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error(
      `${source} is ${(bytes.length / 1024 / 1024).toFixed(1)} MB, over the ` +
        `${MAX_BYTES / 1024 / 1024} MB raw upload limit. Re-export it smaller.`
    )
  }

  await configureCloudinary()
  // Imported here rather than at the top for the reason cloudinary.ts gives:
  // the SDK parses CLOUDINARY_URL at require time and throws a stack trace
  // from inside its own config module before any validation could run.
  const { v2: client } = await import('cloudinary')

  console.log(`Uploading ${source} (${(bytes.length / 1024).toFixed(0)} KB)…`)

  const uploaded = await new Promise<{ version: number; secure_url: string }>(
    (resolve, reject) => {
      const stream = client.uploader.upload_stream(
        {
          public_id: PUBLIC_ID,
          resource_type: 'raw',
          overwrite: true,
          invalidate: true,
          // An upload does not file itself on a dynamic-folder cloud: the
          // folder is a field of its own, and omitting it drops the asset in
          // the root of the Media Library however many slashes the id has.
          asset_folder: 'docs',
          display_name: 'cv-serhii-butko.pdf',
        },
        (error, result) => {
          if (error) return reject(new Error(error.message))
          if (!result) return reject(new Error('Upload returned nothing'))
          resolve({ version: result.version, secure_url: result.secure_url })
        }
      )
      stream.end(bytes)
    }
  )

  const url =
    `https://res.cloudinary.com/${cloudName()}/raw/upload/` +
    `v${uploaded.version}/${PUBLIC_ID}`

  await waitUntilServed(url, bytes.length)

  console.log(`\nUploaded. ${url}`)
  console.log('\nRecord it in src/content/cv.ts:\n')
  console.log('  resume: {')
  console.log(`    publicId: '${PUBLIC_ID}',`)
  console.log(`    version: ${uploaded.version},`)
  console.log('  },')
}

/**
 * Blocks until the versioned URL actually serves the document.
 *
 * A HEAD request, so this does not pull the file back down to prove it is
 * there. The length is checked because a 200 carrying the previous revision is
 * exactly the state being waited out.
 */
async function waitUntilServed(url: string, expectedBytes: number): Promise<void> {
  const deadline = Date.now() + 60_000
  let delay = 500

  for (;;) {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    const length = Number(response.headers.get('content-length') ?? 0)
    if (response.ok && length === expectedBytes) return

    /*
     * 401 `deny or ACL failure` is not a propagation delay and will never
     * clear: this account has PDF and ZIP delivery switched off, which is
     * Cloudinary's default. The upload succeeds, the asset is there, and every
     * request for it is refused. Say so immediately rather than spending sixty
     * seconds waiting for a setting to change on its own.
     */
    if (response.status === 401) {
      throw new Error(
        `${url} uploaded, but Cloudinary refuses to deliver it (401). This ` +
          `account has PDF and ZIP delivery disabled — the default. Turn it on ` +
          `in Settings → Security → "PDF and ZIP files delivery", then re-run ` +
          `this script. The asset itself is fine; only delivery is blocked.`
      )
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `${url} was uploaded but the CDN was still not serving it 60s later ` +
          `(status ${response.status}, ${length} bytes). Refusing to report ` +
          `success: the download link would 404 or hand back the old copy.`
      )
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay * 2, 5_000)
  }
}

main().catch((error: unknown) => {
  console.error(`\nUpload failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
