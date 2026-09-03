/**
 * Names one bottle by hand, and lets CI do the rest.
 *
 *     BOTTLE_BRAND='Tom Ford' BOTTLE_SCENT='Oud Wood' npm run threads:set
 *     npm run threads:set -- --brand 'Tom Ford' --scent 'Oud Wood'
 *
 * Flags for a terminal, environment variables for the workflow — see
 * `.github/workflows/name-bottle.yml`, where they are passed as `env:` rather
 * than interpolated into the `run:` line. A `workflow_dispatch` input is
 * attacker-controlled text in the general case, and `${{ inputs.brand }}`
 * spliced into a shell command is the standard Actions injection; `env:` is
 * the standard answer.
 *
 * ## What this is for
 *
 * `threads:name` fills in what a model can corroborate. This is the other
 * half: the bottles it holds back — a house line the store has never seen, a
 * post whose house is written in prose the grounding check cannot match — plus
 * anything simply typed wrong. Both write the same field the same way, so
 * whichever put a bottle there, `media:organise` renames the pictures after it
 * and the deploy publishes it.
 *
 * The one difference is authority. A model's proposal has to clear two gates
 * in `fragrance-gates.ts` before it may write; a person saying what a bottle
 * is outranks both of them, and the grounding check survives here only as a
 * warning, because it is the shape a mistyped post id makes.
 */

import { type BottleInput, resolveTarget } from './fragrance-gates'
import { configureCloudinary, fetchJson, uploadJson } from './cloudinary'
import { threadsSnapshotSchema } from '../src/lib/threads/schema'
import type { ThreadsSnapshot } from '../src/lib/threads/types'
import { setOutput } from './github-output'

const SNAPSHOT = 'data/threads.json'

/** A flag if given, else the environment, else undefined. */
function read(flag: string, variable: string): string | undefined {
  const at = process.argv.indexOf(`--${flag}`)
  const fromFlag = at === -1 ? undefined : process.argv[at + 1]
  const value = (fromFlag ?? process.env[variable] ?? '').trim()
  return value === '' ? undefined : value
}

function truthy(flag: string, variable: string): boolean {
  if (process.argv.includes(`--${flag}`)) return true
  return (process.env[variable] ?? '').trim().toLowerCase() === 'true'
}

async function main(): Promise<void> {
  const brand = read('brand', 'BOTTLE_BRAND')
  const scent = read('scent', 'BOTTLE_SCENT')
  const collection = read('collection', 'BOTTLE_COLLECTION')
  const wantedId = read('post', 'BOTTLE_POST')
  const overwrite = truthy('overwrite', 'BOTTLE_OVERWRITE')
  const dryRun = truthy('dry-run', 'BOTTLE_DRY_RUN')

  if (!brand || !scent) {
    throw new Error(
      'A brand and a scent are both required — a bottle with one of them is a ' +
        'half-finished edit the schema refuses anyway. Pass --brand and --scent, ' +
        'or set BOTTLE_BRAND and BOTTLE_SCENT.'
    )
  }

  const bottle: BottleInput = { brand, scent, collection }

  await configureCloudinary()
  const raw = await fetchJson<unknown>(SNAPSHOT)
  if (!raw) throw new Error(`${SNAPSHOT} does not exist yet — run the sync first.`)
  const snapshot = threadsSnapshotSchema.parse(raw) as ThreadsSnapshot

  const target = resolveTarget(snapshot.posts, wantedId, bottle, overwrite)
  if (!target.post) throw new Error(target.error ?? 'no post to write to')

  const post = target.post

  // The whole post, before anything is written. A run record that says only
  // "wrote Tom Ford — Oud Wood" cannot be checked afterwards; one that quotes
  // the post being named can.
  console.log(`post      ${post.id}  (${post.timestamp})`)
  console.log(`permalink ${post.permalink}`)
  console.log(`text      ${post.text.slice(0, 160).replace(/\s+/g, ' ')}…`)
  console.log(`pictures  ${post.images.length}`)
  if (target.replacing) {
    const f = target.replacing
    console.log(
      `replacing ${f.brand} — ${f.name}${f.collection ? ` · ${f.collection}` : ''}`
    )
  }
  console.log(`writing   ${brand} — ${scent}${collection ? ` · ${collection}` : ''}`)

  if (target.ungrounded) {
    console.warn(`\n! ${target.ungrounded}.`)
    console.warn('  That is normal for some posts and is exactly what a wrong')
    console.warn('  post id also looks like. Check the text above before trusting it.')
  }

  post.fragrance = { brand, name: scent, ...(collection ? { collection } : {}) }

  // The same schema the build uses, over the whole document: a write that
  // would fail the build must fail here instead.
  threadsSnapshotSchema.parse(snapshot)

  if (dryRun) {
    await setOutput('named', 'false')
    console.log('\n✓ Dry run — nothing written.')
    return
  }

  await uploadJson(SNAPSHOT, snapshot)
  await setOutput('named', 'true')
  await setOutput('post', post.id)
  console.log(`\n✓ Wrote the bottle to ${SNAPSHOT}.`)
  console.log('  Run media:organise to rename its pictures, then deploy.')
}

main().catch((error: unknown) => {
  console.error(`\nNaming failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
