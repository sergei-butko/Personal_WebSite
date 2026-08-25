/**
 * Reports a step output back to GitHub Actions.
 *
 * The syncs used to signal "something changed" by leaving a git diff behind,
 * which the workflow tested with `git status --porcelain`. Now that the
 * snapshots go to Cloudinary there is no diff to read, so the script has to
 * say so itself — otherwise every run would republish the site, including the
 * runs that found nothing.
 *
 * A no-op outside CI, so the scripts behave identically when run by hand.
 */

import { appendFile } from 'node:fs/promises'

export async function setOutput(name: string, value: string): Promise<void> {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  await appendFile(file, `${name}=${value}\n`)
}
