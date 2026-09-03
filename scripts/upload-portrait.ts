/**
 * Re-hosts the profile photograph and prints the fields to record.
 *
 *     npm run cv:portrait -- ~/Downloads/portrait.jpg
 *
 * The picture on the CV comes from the LinkedIn profile, and LinkedIn serves it
 * from a signed URL that expires — so it cannot be hot-linked, and this is the
 * same re-hosting every photograph on the site goes through. Save the original
 * (the 800x800 variant is the largest LinkedIn keeps) and point this at it.
 *
 * `profile/serhii-butko` is stable across replacements: a new portrait
 * overwrites the bytes under the same id, and the version — which this prints
 * and `content/cv.ts` records — is what stops browsers holding the old face for
 * the thirty days Cloudinary's cache-control asks for.
 *
 * Width and height are read back from the upload response rather than assumed,
 * because they are what reserves the box before the bytes land, and a wrong
 * pair is layout shift that only shows on a cold load.
 */

import { readFile } from 'node:fs/promises'
import { uploadImage } from './cloudinary'

const PUBLIC_ID = 'profile/serhii-butko'

async function main(): Promise<void> {
  const source = process.argv[2]
  if (!source) {
    throw new Error(
      'Pass the image: npm run cv:portrait -- <path>. Save the 800x800 ' +
        'variant from the LinkedIn profile; its URL is signed and expires, so ' +
        'it cannot be fetched here.'
    )
  }

  const bytes = await readFile(source).catch(() => {
    throw new Error(`Cannot read ${source}.`)
  })

  console.log(`Uploading ${source} (${(bytes.length / 1024).toFixed(0)} KB)…`)
  const result = await uploadImage(bytes, PUBLIC_ID)

  console.log(`\nUploaded ${result.width}x${result.height}.`)
  console.log('\nRecord it in src/content/cv.ts:\n')
  console.log('  portrait: {')
  console.log(`    publicId: '${result.publicId}',`)
  console.log(`    width: ${result.width},`)
  console.log(`    height: ${result.height},`)
  console.log(`    version: ${result.version},`)
  console.log('  },')
}

main().catch((error: unknown) => {
  console.error(`\nUpload failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
