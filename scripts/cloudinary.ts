/**
 * Cloudinary upload helper, shared by the Telegram and Threads syncs.
 *
 * Credentials come from CLOUDINARY_URL — the single-string form
 * (cloudinary://<api_key>:<api_secret>@<cloud_name>) that the SDK reads on its
 * own. In CI it is a repository secret; locally it belongs in .env.local,
 * which is gitignored. The API secret is never needed at build time and never
 * reaches the browser: the site only ever uses the public cloud name.
 *
 * Uploads are SIGNED, not unsigned. Unsigned presets exist for browser uploads
 * where no secret can be shipped — that is the /admin CMS's case, not this one
 * — and they cannot overwrite an existing public id, which is exactly the
 * property these syncs depend on.
 *
 * The SDK is imported LAZILY, on purpose. It parses CLOUDINARY_URL at require
 * time and throws a raw stack trace from inside its own config module if the
 * string is malformed — before any of our validation could run. Importing it
 * only after the shape is checked means a typo'd secret produces a sentence
 * instead of a stack trace.
 */

export interface UploadResult {
  publicId: string
  width: number
  height: number
}

type CloudinaryApi = (typeof import('cloudinary'))['v2']

let api: CloudinaryApi | null = null
let cloud = ''

/** cloudinary://<api_key>:<api_secret>@<cloud_name> */
const CLOUDINARY_URL_SHAPE = /^cloudinary:\/\/[^:@/]+:[^:@/]+@[^:@/]+\/?$/

/**
 * Validates credentials and loads the SDK. Call before any network work, so a
 * missing or malformed secret fails in the first second of a run rather than
 * after several hundred downloads.
 */
export async function configureCloudinary(): Promise<void> {
  if (api) return

  const url = process.env.CLOUDINARY_URL
  if (!url) {
    throw new Error(
      'CLOUDINARY_URL is not set. Expected cloudinary://<api_key>:<api_secret>@<cloud_name> — ' +
        'a repository secret in CI, or .env.local when running by hand.'
    )
  }
  if (!CLOUDINARY_URL_SHAPE.test(url.trim())) {
    throw new Error(
      'CLOUDINARY_URL is malformed. Expected exactly ' +
        'cloudinary://<api_key>:<api_secret>@<cloud_name> with no path or port. ' +
        'If the api secret contains : @ or /, percent-encode it.'
    )
  }

  const { v2 } = await import('cloudinary')
  v2.config({ secure: true })

  const config = v2.config()
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new Error(
      'CLOUDINARY_URL parsed but produced no cloud name, api key or api secret. ' +
        'Copy it again from the Cloudinary console.'
    )
  }

  api = v2
  cloud = config.cloud_name
}

/** The cloud name the credentials point at, for logging and cross-checks. */
export function cloudName(): string {
  return cloud
}

/**
 * Uploads bytes under a caller-chosen public id, replacing whatever was there.
 *
 * overwrite + invalidate is the whole point: the public id is derived from a
 * stable source id, so re-running a sync replaces an asset in place instead of
 * creating a second copy. The predecessor to this code keyed on a hash of the
 * signed source URL, which rotated on every fetch, and grew the repository by
 * a full copy of the channel every six hours.
 */
export async function uploadImage(
  bytes: Buffer,
  publicId: string
): Promise<UploadResult> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
      },
      (error, uploaded) => {
        if (error) return reject(new Error(error.message))
        if (!uploaded) return reject(new Error(`${publicId}: upload returned nothing`))
        resolve(uploaded as unknown as Record<string, unknown>)
      }
    )
    stream.end(bytes)
  })

  const width = Number(result.width)
  const height = Number(result.height)
  const id = String(result.public_id ?? '')

  if (!id || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(
      `${publicId}: upload succeeded but the response lacked public_id/width/height`
    )
  }

  return { publicId: id, width, height }
}

/**
 * Every asset id under a folder prefix. Paginated; Cloudinary caps a page at
 * 500. Used only by the prune step, which needs to know what is there in
 * order to spot what the snapshot no longer references.
 */
export async function listAssetIds(prefix: string): Promise<string[]> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  const ids: string[] = []
  let cursor: string | undefined

  do {
    const page = await client.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix,
      max_results: 500,
      next_cursor: cursor,
    })
    for (const asset of page.resources ?? []) {
      if (asset.public_id) ids.push(String(asset.public_id))
    }
    cursor = page.next_cursor as string | undefined
  } while (cursor)

  return ids
}

/**
 * Permanently deletes assets. Batched at 100, which is the API's limit.
 *
 * Only ever called with ids the caller has already checked against a freshly
 * built snapshot — see the prune step in sync-telegram.ts, which is opt-in
 * for that reason.
 */
export async function deleteAssets(publicIds: string[]): Promise<number> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  let deleted = 0
  for (let i = 0; i < publicIds.length; i += 100) {
    const batch = publicIds.slice(i, i + 100)
    const result = await client.api.delete_resources(batch)
    deleted += Object.keys(result.deleted ?? {}).length
  }
  return deleted
}
