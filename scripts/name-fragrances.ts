/**
 * Fills in the bottle a Threads post is about.
 *
 *     npm run threads:name              write
 *     npm run threads:name -- --dry-run report, change nothing
 *     npm run threads:name -- --check 8 re-propose 8 already-named posts, write nothing
 *
 * ## Why this is not part of the sync itself
 *
 * The Threads API has no fragrance field and never will — it returns a body of
 * prose, and which bottle it reviews is a reading, not a value. `lib/threads`
 * says so, and everything the sync captures still arrives with `fragrance`
 * absent. For a year that gap was closed by hand through content:pull/push.
 *
 * This closes most of it automatically, and the whole design is about the word
 * MOST. Never overwrite a row that already has one — hand edits win over this
 * script the same way they win over a sync. The two gates that decide what a
 * proposal is allowed to write are in `fragrance-gates.ts`, kept pure and
 * separate so `npm run test:threads-name` can pin them without spending money on the
 * API; read that file's header for why they exist and what they measure.
 */

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { configureCloudinary, fetchJson, uploadJson } from './cloudinary'
import { threadsSnapshotSchema } from '../src/lib/threads/schema'
import type { ThreadsSnapshot, ThreadsPost } from '../src/lib/threads/types'
import { setOutput } from './github-output'
import { decide, grounded, knownLines } from './fragrance-gates'

const SNAPSHOT = 'data/threads.json'
const MODEL = 'claude-opus-5'

/** What the model is asked to return for one post. */
const proposalSchema = z.object({
  brand: z.string().describe('The house, in its own Latin-script spelling — "Tom Ford".'),
  name: z.string().describe('The scent, without the house — "Oud Wood".'),
  collection: z
    .string()
    .nullable()
    .describe(
      'The house line this bottle belongs to — "Private Blend", "UNUM". ' +
        'null when the house has no lines, when the bottle sits outside them, ' +
        'or when you are unsure.'
    ),
  evidence: z
    .string()
    .describe(
      'The words from the post that name the house and the scent, quoted exactly.'
    ),
})

type Proposal = z.infer<typeof proposalSchema>

const SYSTEM = `You identify which fragrance a review is about.

The reviews are in Ukrainian. The house is often written as an Instagram-style
handle rather than as prose — "@tomford", "@pana.dora.sweden" — and the scent
is usually in Latin script inside the Ukrainian sentence.

Rules:
- Return the house and the scent as the fragrance world spells them, not as the
  post spells them: "@maisonfranciskurkdjian" is "Maison Francis Kurkdjian".
- The scent is the bottle, not its notes. A review naming bergamot, oud and
  musk is not a review of "Bergamot".
- Names of films, books, people and places mentioned for atmosphere are not the
  bottle. So are the names of other fragrances the writer compares it to — the
  bottle is the one being reviewed.
- "collection" is the house's line. It is usually NOT stated in the post; give
  it only when you know the house's ranges and are confident this bottle sits
  in one. Otherwise null. A guess here is worse than a null.
- "evidence" must be copied from the post, not paraphrased.`

/**
 * The API client.
 *
 * An identity-linked key is scoped to a workspace and the API rejects a request
 * that does not say which — `anthropic-workspace-id is required`. The SDK has
 * no parameter for it, so it goes in as a default header; a plain key ignores
 * it, which is why this is unconditional rather than a branch.
 */
function anthropic(): Anthropic {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID
  return new Anthropic({
    defaultHeaders: workspace ? { 'anthropic-workspace-id': workspace } : {},
  })
}

/**
 * One post, one proposal — or null when this post could not be named.
 *
 * `Anthropic.APIError` (in this SDK, the base class every status AND
 * connection error extends — unlike Python, where connection errors are a
 * sibling, not a subclass) is caught here rather than left to abort the run.
 * A rate limit or a network blip on post 5 of 10 must not cost the other nine
 * their bottles, and it must not cost the day's real Threads content its
 * organise/verify/deploy — naming is the optional layer on top of a pipeline
 * that already treats "no fragrance yet" as fully supported. A skipped post
 * is retried automatically tomorrow; nothing here is written until the whole
 * batch succeeds.
 *
 * A genuinely unexpected error — not the SDK reporting the API failed, but
 * this script being wrong — still propagates and aborts loudly, which is the
 * correct outcome for a real bug.
 */
async function propose(client: Anthropic, post: ThreadsPost): Promise<Proposal | null> {
  let response: Awaited<ReturnType<typeof client.messages.parse>>
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(proposalSchema) },
      messages: [{ role: 'user', content: post.text }],
    })
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.warn(`  ${post.id}: ${error.message} — skipping, left for tomorrow`)
      return null
    }
    throw error
  }

  if (response.stop_reason === 'refusal') {
    console.warn(`  ${post.id}: the model declined to answer, skipping`)
    return null
  }
  return response.parsed_output ?? null
}

interface Outcome {
  id: string
  applied?: { brand: string; name: string; collection?: string }
  skipped?: string
  suggestion?: string
}

/**
 * Re-proposes bottles for posts that ALREADY have one, and reports agreement.
 *
 *     npm run threads:name -- --check 8
 *
 * The 96 hand-named rows are ground truth, so this is the only honest way to
 * find out what the gates are worth before trusting them with the store.
 * Writes nothing, ever.
 */
async function check(
  client: Anthropic,
  posts: ThreadsPost[],
  sample: number
): Promise<void> {
  const named = posts.filter((p) => p.fragrance && p.text.trim()).slice(0, sample)
  const lines = knownLines(posts)
  let exact = 0
  let wrong = 0
  let held = 0

  for (const post of named) {
    const truth = post.fragrance
    if (!truth) continue
    const proposal = await propose(client, post)
    if (!proposal) continue

    const passes =
      grounded(proposal.brand, post.text) && grounded(proposal.name, post.text)
    const line = proposal.collection
      ? lines.get(proposal.brand.toLowerCase())?.get(proposal.collection.toLowerCase())
      : undefined

    const same =
      proposal.brand.toLowerCase() === truth.brand.toLowerCase() &&
      proposal.name.toLowerCase() === truth.name.toLowerCase()

    const verdict = !passes
      ? same
        ? 'held (correct)'
        : 'held'
      : same
        ? 'agrees'
        : 'DISAGREES'
    if (!passes) held += 1
    else if (same) exact += 1
    else wrong += 1

    console.log(
      `${verdict.padEnd(15)} truth ${truth.brand} — ${truth.name}` +
        (truth.collection ? ` · ${truth.collection}` : '') +
        `\n                proposed ${proposal.brand} — ${proposal.name}` +
        (proposal.collection
          ? ` · ${proposal.collection}${line ? '' : ' (would be dropped)'}`
          : '')
    )
  }

  console.log(
    `\n${named.length} checked — ${exact} agree, ${wrong} disagree, ${held} held by the gates`
  )
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const checkAt = process.argv.indexOf('--check')

  await configureCloudinary()
  const raw = await fetchJson<unknown>(SNAPSHOT)
  if (!raw) throw new Error(`${SNAPSHOT} does not exist yet — run the sync first.`)

  const snapshot = threadsSnapshotSchema.parse(raw) as ThreadsSnapshot

  if (checkAt !== -1) {
    const sample = Number(process.argv[checkAt + 1] ?? 8)
    await check(anthropic(), snapshot.posts, sample)
    return
  }

  const pending = snapshot.posts.filter((post) => !post.fragrance && post.text.trim())

  console.log(`${snapshot.posts.length} post(s), ${pending.length} without a bottle`)
  if (pending.length === 0) {
    await setOutput('named', 'false')
    console.log('\n✓ Nothing to name.')
    return
  }

  const lines = knownLines(snapshot.posts)
  const client = anthropic()
  const outcomes: Outcome[] = []

  for (const post of pending) {
    console.log(`\n${post.id}`)
    const proposal = await propose(client, post)
    if (!proposal) {
      outcomes.push({ id: post.id, skipped: 'no proposal returned' })
      continue
    }

    console.log(
      `  proposed: ${proposal.brand} — ${proposal.name}` +
        (proposal.collection ? ` (${proposal.collection})` : '')
    )

    const decision = decide(proposal, post.text, lines)

    if (!decision.fragrance) {
      console.log(`  ✗ the ${decision.held} — left for you`)
      outcomes.push({
        id: post.id,
        skipped: decision.held,
        suggestion: `${proposal.brand} — ${proposal.name}`,
      })
      continue
    }

    if (decision.unconfirmedLine) {
      console.log(
        `  · line "${decision.unconfirmedLine}" is new for ${proposal.brand} — left absent`
      )
    }

    post.fragrance = decision.fragrance
    const { brand, name, collection } = decision.fragrance
    console.log(`  ✓ ${brand} — ${name}${collection ? ` · ${collection}` : ''}`)
    outcomes.push({
      id: post.id,
      applied: decision.fragrance,
      suggestion: decision.unconfirmedLine
        ? `line "${decision.unconfirmedLine}"?`
        : undefined,
    })
  }

  const applied = outcomes.filter((o) => o.applied)
  const left = outcomes.filter((o) => !o.applied)

  console.log(`\n${applied.length} named, ${left.length} left for you`)
  for (const o of left) {
    console.log(
      `  ${o.id}: ${o.skipped}${o.suggestion ? ` — suggested ${o.suggestion}` : ''}`
    )
  }
  for (const o of applied.filter((x) => x.suggestion)) {
    console.log(`  ${o.id}: ${o.suggestion}`)
  }

  if (applied.length === 0) {
    await setOutput('named', 'false')
    console.log('\n✓ Nothing written.')
    return
  }

  if (dryRun) {
    await setOutput('named', 'false')
    console.log('\n✓ Dry run — nothing written.')
    return
  }

  // The same schema the build uses, over the whole document rather than the
  // rows just touched: a write that would fail the build must fail here.
  threadsSnapshotSchema.parse(snapshot)
  await uploadJson(SNAPSHOT, snapshot)
  await setOutput('named', 'true')
  console.log(`\n✓ Wrote ${applied.length} bottle(s) to ${SNAPSHOT}.`)
  console.log('  Run media:organise to rename their pictures, then deploy.')
}

main().catch((error: unknown) => {
  console.error(`\nNaming failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
