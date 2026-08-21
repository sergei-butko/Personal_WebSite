/**
 * Tests for the dedup decision. Run with `npm run test:dedup`.
 *
 * No network, no credentials — these are the rules that decide whether an
 * image is uploaded again, and they are worth being sure about.
 */

import assert from 'node:assert/strict'
import { decideAsset, type StoredSize } from './photo-dedup'

let passed = 0
function test(name: string, run: () => void): void {
  run()
  console.log(`✓ ${name}`)
  passed++
}

const size = (w: number, h: number): StoredSize => ({ width: w, height: h })

test('an unseen hash is uploaded', () => {
  const decision = decideAsset('aaa', 'telegram/10-0', new Map(), new Map())
  assert.equal(decision.kind, 'upload')
  assert.equal(decision.kind === 'upload' && decision.reason, 'new')
})

test('a hash already stored under another id is reused, not uploaded', () => {
  const decision = decideAsset(
    'aaa',
    'telegram/20-0',
    new Map([['aaa', 'telegram/10-0']]),
    new Map([['telegram/10-0', size(1600, 1200)]])
  )
  assert.deepEqual(decision, {
    kind: 'reuse',
    publicId: 'telegram/10-0',
    width: 1600,
    height: 1200,
  })
})

test('the same photo in its own slot is re-uploaded, not self-referenced', () => {
  const decision = decideAsset(
    'aaa',
    'telegram/10-0',
    new Map([['aaa', 'telegram/10-0']]),
    new Map([['telegram/10-0', size(800, 600)]])
  )
  assert.equal(decision.kind, 'upload')
  assert.equal(decision.kind === 'upload' && decision.reason, 'same-id')
})

test('a known hash with unknown dimensions uploads rather than guessing', () => {
  const decision = decideAsset(
    'aaa',
    'telegram/20-0',
    new Map([['aaa', 'telegram/10-0']]),
    new Map()
  )
  assert.equal(decision.kind, 'upload')
  assert.equal(decision.kind === 'upload' && decision.reason, 'no-dimensions')
})

test('three posts of one image yield one asset', () => {
  const hashes = new Map<string, string>()
  const dimensions = new Map<string, StoredSize>()
  const ids: string[] = []

  for (const publicId of ['telegram/10-0', 'telegram/20-0', 'telegram/30-0']) {
    const decision = decideAsset('same', publicId, hashes, dimensions)
    if (decision.kind === 'upload') {
      hashes.set('same', publicId)
      dimensions.set(publicId, size(800, 600))
      ids.push(publicId)
    } else {
      ids.push(decision.publicId)
    }
  }

  assert.deepEqual(ids, ['telegram/10-0', 'telegram/10-0', 'telegram/10-0'])
  assert.equal(new Set(ids).size, 1)
})

test('different images never collapse', () => {
  const hashes = new Map([['aaa', 'telegram/10-0']])
  const dimensions = new Map([['telegram/10-0', size(800, 600)]])
  const decision = decideAsset('bbb', 'telegram/20-0', hashes, dimensions)
  assert.equal(decision.kind, 'upload')
})

console.log(`\nAll ${passed} checks passed.`)
