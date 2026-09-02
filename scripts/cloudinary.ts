/**
 * Cloudinary upload helper, shared by the Telegram and Threads syncs.
 *
 * Credentials come from CLOUDINARY_URL — the single-string form
 * (cloudinary://<api_key>:<api_secret>@<cloud_name>) that the SDK reads on its
 * own. In CI it is a repository secret; locally it belongs in .env.local,
 * which is gitignored. The API secret is never needed at build time and never
 * reaches the browser: the site only ever uses the public cloud name.
 *
 * Uploads are SIGNED, not unsigned. Unsigned presets exist for uploads from a
 * browser, where no secret can be shipped; these scripts run on a machine that
 * has one. And an unsigned preset cannot overwrite an existing public id,
 * which is exactly the property these syncs depend on.
 *
 * The SDK is imported LAZILY, on purpose. It parses CLOUDINARY_URL at require
 * time and throws a raw stack trace from inside its own config module if the
 * string is malformed — before any of our validation could run. Importing it
 * only after the shape is checked means a typo'd secret produces a sentence
 * instead of a stack trace.
 */

/**
 * The Media Library placement an id implies: everything before the last slash
 * is the folder, the last segment is the name.
 *
 * This exists because an upload does NOT file itself. On a dynamic-folder
 * cloud — which this one is — `asset_folder` is a field of its own, and an
 * upload that omits it drops the asset in the ROOT of the Media Library however
 * many slashes its public id has. That is how 653 assets came to sit in one
 * undifferentiated list, and how two images from a post synced on 2026-09-01
 * landed back there weeks after the migration that was meant to end it.
 *
 * Deriving it here rather than taking it as an argument keeps every caller
 * honest: the folder cannot drift from the id, because it IS the id.
 * `display_name` goes with it, since that does not follow an id either.
 */
function placement(publicId: string): Record<string, string> {
  const cut = publicId.lastIndexOf('/')
  if (cut === -1) return { display_name: publicId }
  return {
    asset_folder: publicId.slice(0, cut),
    display_name: publicId.slice(cut + 1),
  }
}

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
        ...placement(publicId),
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
 * Uploads an audio file under a caller-chosen public id.
 *
 * resource_type is 'video', which is not a typo — Cloudinary has no separate
 * audio type and files every sound under video. Delivery is the same shape
 * (/video/upload/), which is why lib/media.ts builds the URL rather than the
 * caller guessing at it.
 *
 * Nothing is returned but the id: unlike an image there is no width or height
 * worth carrying, and duration comes from Telegram, which knows the real value
 * rather than one inferred from a container.
 */
export async function uploadAudio(bytes: Buffer, publicId: string): Promise<string> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'video',
        ...placement(publicId),
      },
      (error, uploaded) => {
        if (error) return reject(new Error(error.message))
        if (!uploaded) return reject(new Error(`${publicId}: upload returned nothing`))
        resolve(uploaded as unknown as Record<string, unknown>)
      }
    )
    stream.end(bytes)
  })

  const id = String(result.public_id ?? '')
  if (!id) {
    throw new Error(`${publicId}: upload succeeded but the response lacked public_id`)
  }
  return id
}

/** image, video (which is where audio lives) or raw. */
export type ResourceType = 'image' | 'video' | 'raw'

/**
 * Every asset id under a folder prefix. Paginated; Cloudinary caps a page at
 * 500. Used only by the prune step, which needs to know what is there in
 * order to spot what the snapshot no longer references.
 */
export async function listAssetIds(
  prefix: string,
  resourceType: ResourceType = 'image'
): Promise<string[]> {
  return (await listAssets(resourceType, prefix)).map((asset) => asset.publicId)
}

/** One asset as the Admin API describes it. */
export interface AssetRow {
  publicId: string
  /**
   * Where the Media Library files it. INDEPENDENT of publicId on this cloud —
   * see the header of scripts/media-name.ts. '' means the root, which is where
   * every asset uploaded by these scripts landed before `media:organise`.
   */
  assetFolder: string
  bytes: number
}

/**
 * Every asset of one resource type, optionally under a prefix.
 *
 * Paginated at 500, so the whole account is a handful of calls. That matters:
 * the Admin API is capped at 500 requests an hour on this plan, and asking
 * about 651 assets one at a time would blow through it in a single run. Listing
 * once and holding the answer in memory is what keeps `media:organise` inside
 * the budget — see the note on setAssetFolder for the other half of that.
 */
export async function listAssets(
  resourceType: ResourceType,
  prefix?: string
): Promise<AssetRow[]> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  const rows: AssetRow[] = []
  let cursor: string | undefined

  do {
    const page = await client.api.resources({
      type: 'upload',
      resource_type: resourceType,
      ...(prefix ? { prefix } : {}),
      max_results: 500,
      next_cursor: cursor,
    })
    for (const asset of page.resources ?? []) {
      if (!asset.public_id) continue
      rows.push({
        publicId: String(asset.public_id),
        assetFolder: String(asset.asset_folder ?? ''),
        bytes: Number(asset.bytes ?? 0),
      })
    }
    cursor = page.next_cursor as string | undefined
  } while (cursor)

  return rows
}

/**
 * Changes an asset's public id, and therefore its delivery URL.
 *
 * `overwrite` is deliberately NOT passed, so Cloudinary refuses rather than
 * destroying whatever is already at the target. Two bottles that slug to the
 * same name is the failure this guards against, and the caller checks for it
 * first — this is the second line, not the first.
 *
 * `invalidate` purges the old URL from the CDN. Without it the previous id
 * keeps serving from cache for hours, which hides a half-finished migration.
 */
export async function renameAsset(
  from: string,
  to: string,
  resourceType: ResourceType = 'image'
): Promise<void> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  await client.uploader.rename(from, to, {
    resource_type: resourceType,
    invalidate: true,
  })
}

/**
 * Files an asset under a Media Library folder, and names it there.
 *
 * `uploader.explicit`, not `api.update`, and that is the whole point of this
 * function. Both write `asset_folder`, but `api.update` is an ADMIN API call
 * and this account is capped at 500 of those an hour — fewer than the 651
 * assets a full `media:organise` touches, so the obvious implementation
 * fails most of the way through and leaves the store half-moved. `explicit`
 * is an Upload API call and is not on that budget.
 *
 * Renaming does NOT move an asset: `uploader.rename` leaves `asset_folder`
 * exactly as it was, and neither `asset_folder` nor `to_asset_folder` is
 * honoured as a rename option. Both were tried. This call is the only thing
 * that moves anything.
 *
 * `display_name` is set alongside, because it does not follow a rename either
 * — an asset renamed to `Dior-Fahrenheit-1` went on calling itself
 * `17956459470243614-0` in the Media Library until it was written explicitly.
 */
export async function setAssetFolder(
  publicId: string,
  folder: string,
  displayName: string,
  resourceType: ResourceType = 'image'
): Promise<void> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  /*
   * Cast because the SDK's `explicit` overloads only admit the transformation
   * options it was written for, and `asset_folder` / `display_name` are newer
   * than the types. The call itself is documented and the response carries the
   * new folder back, which is what the caller verifies against.
   */
  const explicit = client.uploader.explicit as (
    publicId: string,
    options: Record<string, unknown>
  ) => Promise<Record<string, unknown>>

  await explicit(publicId, {
    type: 'upload',
    resource_type: resourceType,
    asset_folder: folder,
    display_name: displayName,
  })
}

/**
 * Permanently deletes assets. Batched at 100, which is the API's limit.
 *
 * Only ever called with ids the caller has already checked against a freshly
 * built snapshot — see the prune step in sync-telegram.ts, which is opt-in
 * for that reason.
 */
export async function deleteAssets(
  publicIds: string[],
  resourceType: ResourceType = 'image'
): Promise<number> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  let deleted = 0
  for (let i = 0; i < publicIds.length; i += 100) {
    const batch = publicIds.slice(i, i + 100)
    // resource_type is not optional in practice: it defaults to image, so a
    // batch of songs would report success and delete nothing.
    const result = await client.api.delete_resources(batch, {
      resource_type: resourceType,
    })
    deleted += Object.keys(result.deleted ?? {}).length
  }
  return deleted
}

/**
 * Uploads a JSON snapshot as a `raw` asset.
 *
 * The snapshots used to be committed .ts files. They are here now so the repo
 * holds no generated content at all and a sync produces no commit — see
 * docs/RUNBOOK-CLOUDINARY.md. The trade is that the site build fetches them
 * over the network and fails loudly when it cannot, rather than falling back
 * to a stale copy in git.
 *
 * overwrite + invalidate matter more here than for images: the build reads
 * this back immediately after a sync, and a CDN serving the previous version
 * would silently deploy stale content.
 */
export async function uploadJson(publicId: string, data: unknown): Promise<void> {
  await configureCloudinary()
  const client = api
  if (!client) throw new Error('Cloudinary was not configured')

  const body = JSON.stringify(data, null, 2)

  await new Promise<void>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'raw',
        ...placement(publicId),
      },
      (error, uploaded) => {
        if (error) return reject(new Error(error.message))
        if (!uploaded) return reject(new Error(`${publicId}: upload returned nothing`))
        resolve()
      }
    )
    stream.end(Buffer.from(body, 'utf8'))
  })

  await waitUntilVisible(publicId, body)
}

/**
 * Blocks until the delivery CDN actually serves what was just written.
 *
 * Cloudinary raw delivery is eventually consistent. Measured on this account,
 * an overwrite took about four seconds to appear, and a `?v=<now>` cache-buster
 * did not defeat it — a deleted asset was still served from cache too.
 *
 * That is a real problem, because a sync dispatches the deploy the moment it
 * finishes: a build starting inside that window fetches the PREVIOUS snapshot
 * and publishes it, with nothing anywhere reporting a fault. The next sync
 * reading a stale snapshot is worse still — it would append to an old document
 * and drop whatever came between.
 *
 * So "the sync succeeded" is defined as "the new content is visible", not
 * "the upload returned 200". If it never converges, that is a hard failure:
 * a silent wrong-content deploy is the thing being prevented.
 */
async function waitUntilVisible(publicId: string, expected: string): Promise<void> {
  const deadline = Date.now() + 60_000
  let delay = 500

  for (;;) {
    const seen = await fetchJson<unknown>(publicId)
    if (seen !== null && JSON.stringify(seen, null, 2) === expected) return

    if (Date.now() >= deadline) {
      throw new Error(
        `${publicId} was uploaded but the CDN was still serving the old copy 60s ` +
          `later. Refusing to report success: a deploy started now would publish ` +
          `stale content. Re-run the sync.`
      )
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay * 2, 5_000)
  }
}

/**
 * Reads a JSON snapshot back, bypassing the CDN cache.
 *
 * Returns null when the asset does not exist yet — a first run, which is not
 * an error. Any other failure throws, because a sync that silently treats a
 * fetch failure as "no previous state" would re-upload the whole channel.
 */
export async function fetchJson<T>(publicId: string): Promise<T | null> {
  await configureCloudinary()
  const url =
    `https://res.cloudinary.com/${cloud}/raw/upload/${encodeURI(publicId)}` +
    `?v=${Date.now()}`

  const res = await fetch(url, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`Could not read ${publicId} from Cloudinary: HTTP ${res.status}`)
  }
  return (await res.json()) as T
}
