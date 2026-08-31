/**
 * Pins the Cloudinary naming rules.
 *
 * These decide what a file is called on a store that is not in git, and a
 * rename is not free to get wrong: `organise-media.ts` moves live assets to
 * whatever this file says, and the snapshot has to agree with it exactly or
 * the site renders 188 broken images. A pure rule with real inputs is cheap to
 * pin and expensive to check by looking.
 *
 * Every awkward case below is taken from the actual archive — the diacritics,
 * the apostrophes, the parenthesis, the interpunct and the hyphenated house
 * are all names Serhii has written. `npm run test:names`.
 */

import {
  THREADS_IMAGE_FOLDER,
  TELEGRAM_AUDIO_FOLDER,
  TELEGRAM_IMAGE_FOLDER,
  displayNameOf,
  folderOf,
  slugPart,
  telegramAudioId,
  telegramImageId,
  threadsImageId,
} from './media-name'

let failed = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.error(`✗ ${label}\n    expected ${b}\n    actual   ${a}`)
  }
}

// --- slugPart -------------------------------------------------------------

check('a plain name keeps its case', slugPart('Tom Ford'), 'Tom_Ford')
check('spaces become underscores', slugPart('Oud Satin Mood'), 'Oud_Satin_Mood')

// The separator may never appear inside a field.
check(
  'a hyphenated house does not keep its hyphen',
  slugPart('Marc-Antoine Barrois'),
  'Marc_Antoine_Barrois'
)
check('no output contains a hyphen', /-/.test(slugPart('Marc-Antoine Barrois')), false)

// Diacritics fold to ASCII rather than being percent-encoded into the URL.
check('macron and acute fold', slugPart('Wūlóng Chá'), 'Wulong_Cha')
check('acute folds', slugPart('Ombré Leather'), 'Ombre_Leather')
check('grave folds', slugPart('Hermès'), 'Hermes')
check('diaeresis folds', slugPart('Althaïr'), 'Althair')
check(
  'a folded name is pure ASCII',
  /^[A-Za-z0-9_]*$/.test(slugPart('Bois Impérial')),
  true
)

// An apostrophe is deleted, not replaced, or every possessive grows a stray _.
check('apostrophes vanish', slugPart("Sister's Aroma"), 'Sisters_Aroma')
check('curly apostrophes vanish too', slugPart('Sister’s Aroma'), 'Sisters_Aroma')
check('an elision closes up', slugPart("Terre d'Hermès"), 'Terre_dHermes')

// Punctuation collapses instead of leaving runs or trailing separators.
check('parentheses collapse', slugPart('Bleu de Chanel (EDP)'), 'Bleu_de_Chanel_EDP')
check(
  'a plus sign collapses',
  slugPart('Molecule 01 + Patchouli'),
  'Molecule_01_Patchouli'
)
check('an interpunct collapses', slugPart('MOLeCULE 234·38'), 'MOLeCULE_234_38')
check('runs never double up', slugPart('a  --  b'), 'a_b')
check('the ends are trimmed', slugPart('  (Nishane)  '), 'Nishane')
check('digits survive', slugPart('Kajal I'), 'Kajal_I')

// The empty answer is a real answer: callers fall back to the source id.
check('a name with no ASCII at all yields nothing', slugPart('Парфуми'), '')
check('punctuation alone yields nothing', slugPart('!!!'), '')

// --- threadsImageId -------------------------------------------------------

check(
  'a named bottle reads as Brand-Scent-n',
  threadsImageId({ brand: 'Tom Ford', name: 'Oud Wood' }, '17956459470243614', 0),
  `${THREADS_IMAGE_FOLDER}/Tom_Ford-Oud_Wood-1`
)
check(
  'the image number counts from one, not zero',
  threadsImageId({ brand: 'Dior', name: 'Fahrenheit' }, '123', 1),
  `${THREADS_IMAGE_FOLDER}/Dior-Fahrenheit-2`
)
check(
  'a name has exactly two separators',
  threadsImageId({ brand: 'Marc-Antoine Barrois', name: 'Tilia' }, '123', 0)
    .slice(THREADS_IMAGE_FOLDER.length + 1)
    .split('-').length,
  3
)

// The fragrance is hand-written and absent at capture time — this is the
// state every freshly synced post is in, not an edge case.
check(
  'an unnamed post keeps its post id',
  threadsImageId(undefined, '17956459470243614', 0),
  `${THREADS_IMAGE_FOLDER}/17956459470243614-0`
)
check(
  'a half-named post keeps its post id rather than emitting a blank field',
  threadsImageId({ brand: 'Nishane', name: '' }, '999', 0),
  `${THREADS_IMAGE_FOLDER}/999-0`
)
check(
  'an unslugabble house keeps its post id',
  threadsImageId({ brand: 'Парфуми', name: 'Vetiver' }, '999', 1),
  `${THREADS_IMAGE_FOLDER}/999-1`
)

// Idempotence is what makes `media:organise` safe to run twice: the id derived
// from an already-correct row must be the row's own id.
const stable = threadsImageId({ brand: 'Orto Parisi', name: 'Stercus' }, '1', 0)
check(
  'deriving twice gives the same answer',
  threadsImageId({ brand: 'Orto Parisi', name: 'Stercus' }, '1', 0),
  stable
)

// --- telegram ids and helpers ---------------------------------------------

check(
  'a telegram photo keeps message id and slot',
  telegramImageId(571, 2),
  `${TELEGRAM_IMAGE_FOLDER}/571-2`
)
check(
  'a telegram song keeps its own message id',
  telegramAudioId(554),
  `${TELEGRAM_AUDIO_FOLDER}/554`
)

check(
  'folderOf splits at the last slash',
  folderOf('threads/images/Dior-Fahrenheit-1'),
  'threads/images'
)
check('folderOf is empty at the root', folderOf('photos'), '')
check(
  'displayNameOf is the last segment',
  displayNameOf('threads/images/Dior-Fahrenheit-1'),
  'Dior-Fahrenheit-1'
)
check('displayNameOf handles a rootless id', displayNameOf('photos'), 'photos')

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
