/**
 * Editing the content store by hand.
 *
 *   npm run content:pull    Cloudinary -> content-local/
 *   npm run content:push    content-local/ -> Cloudinary
 *
 * The snapshots in Cloudinary are the canonical copy of the site's posts and
 * photos — the syncs only ever append, so anything edited here survives them.
 * This is how that editing happens now that there is no /admin.
 *
 * Two things make it safe enough to run against live content:
 *
 * - VALIDATION. A push is checked against the same zod schemas the site build
 *   uses, so a malformed edit is refused here rather than breaking the next
 *   deploy — where it would fail loudly but only after you had stopped paying
 *   attention.
 *
 * - A STALENESS CHECK. Pull records exactly what it fetched. Push re-reads
 *   Cloudinary and refuses if anything changed in the meantime, because a
 *   whole-document write would silently drop whatever a sync appended while
 *   the file sat open in an editor.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { configureCloudinary, cloudName, fetchJson, uploadJson } from './cloudinary'
import { photoSnapshotSchema } from '../src/lib/photos/schema'
import { threadsSnapshotSchema } from '../src/lib/threads/schema'
import type { ZodType } from 'zod'

const DIR = 'content-local'

interface Doc {
  /** Cloudinary public id. */
  id: string
  /** Local filename. */
  file: string
  schema: ZodType<unknown>
  label: string
}

const DOCS: Doc[] = [
  {
    id: 'data/photos.json',
    file: 'photos.json',
    schema: photoSnapshotSchema,
    label: 'photos',
  },
  {
    id: 'data/threads.json',
    file: 'threads.json',
    schema: threadsSnapshotSchema,
    label: 'posts',
  },
]

/** What pull saw, so push can tell whether Cloudinary moved underneath it. */
const BASELINE = '.baseline.json'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function count(value: unknown): number {
  const record = value as { photos?: unknown[]; posts?: unknown[] }
  return (record.photos ?? record.posts ?? []).length
}

async function pull(): Promise<void> {
  await mkdir(DIR, { recursive: true })
  const baseline: Record<string, string> = {}

  for (const doc of DOCS) {
    const value = await fetchJson<unknown>(doc.id)
    if (!value) fail(`${doc.id} does not exist in Cloudinary. Run the sync first.`)

    const text = JSON.stringify(value, null, 2)
    await writeFile(`${DIR}/${doc.file}`, text + '\n')
    baseline[doc.id] = text
    console.log(`  ${doc.file.padEnd(13)} ${count(value)} ${doc.label}`)
  }

  await writeFile(`${DIR}/${BASELINE}`, JSON.stringify(baseline, null, 2))
  console.log(`\n✓ Pulled into ${DIR}/. Edit the files, then: npm run content:push`)
}

async function push(): Promise<void> {
  let baseline: Record<string, string>
  try {
    baseline = JSON.parse(await readFile(`${DIR}/${BASELINE}`, 'utf8')) as typeof baseline
  } catch {
    fail(
      `No ${DIR}/${BASELINE}. Run "npm run content:pull" first — pushing without a baseline could overwrite content a sync added.`
    )
  }

  const pending: Array<{ doc: Doc; value: unknown }> = []

  for (const doc of DOCS) {
    let text: string
    try {
      text = await readFile(`${DIR}/${doc.file}`, 'utf8')
    } catch {
      fail(`${DIR}/${doc.file} is missing. Re-run "npm run content:pull".`)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      fail(`${doc.file} is not valid JSON: ${(error as Error).message}`)
    }

    // The same schema the build uses. Better to be refused here than to
    // discover it in a failed deploy.
    const result = doc.schema.safeParse(parsed)
    if (!result.success) {
      console.error(`✗ ${doc.file} does not match the expected shape:`)
      for (const issue of result.error.issues.slice(0, 10)) {
        console.error(`    ${issue.path.join('.') || '(root)'} — ${issue.message}`)
      }
      process.exit(1)
    }

    // Unchanged files are skipped rather than re-uploaded: a write invalidates
    // the CDN copy, and doing that for nothing is pure churn.
    const current = JSON.stringify(parsed, null, 2)
    if (current === baseline[doc.id]) {
      console.log(`  ${doc.file.padEnd(13)} unchanged, skipping`)
      continue
    }

    const remote = await fetchJson<unknown>(doc.id)
    if (remote && JSON.stringify(remote, null, 2) !== baseline[doc.id]) {
      fail(
        `${doc.id} changed in Cloudinary since you pulled — a sync has probably run.\n` +
          `  Pushing now would delete whatever it added. Re-pull, redo the edit, and push again.`
      )
    }

    pending.push({ doc, value: result.data })
  }

  if (pending.length === 0) {
    console.log('\n✓ Nothing to push.')
    return
  }

  for (const { doc, value } of pending) {
    await uploadJson(doc.id, value)
    console.log(`  ${doc.file.padEnd(13)} ${count(value)} ${doc.label} uploaded`)
  }

  // Re-baseline, so a second push without a fresh pull is not refused.
  const next: Record<string, string> = { ...baseline }
  for (const { doc, value } of pending) next[doc.id] = JSON.stringify(value, null, 2)
  await writeFile(`${DIR}/${BASELINE}`, JSON.stringify(next, null, 2))

  console.log('\n✓ Pushed. The perfumery and photo views re-read this in the browser,')
  console.log('  so the edit is live on the next page load — no deploy needed.')
  console.log('  Changed a fragrance? Run media:organise to rename its images.')
}

async function main(): Promise<void> {
  await configureCloudinary()
  console.log(`→ cloudinary cloud: ${cloudName()}`)

  const mode = process.argv[2]
  if (mode === 'pull') return pull()
  if (mode === 'push') return push()
  fail(`Unknown mode "${mode ?? ''}". Use "pull" or "push".`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
