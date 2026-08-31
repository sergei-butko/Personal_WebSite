# Moving images out of git

Photos and Threads images are re-hosted in Cloudinary, and so are the
generated snapshots that index them. Nothing generated is in the repository at
all.

> **The migration below is done. Steps 1–6 are a record, not a procedure.**
>
> It ran in August 2026. `public/images/` is gone from history, the credentials
> exist, and both syncs write to Cloudinary. **Do not run step 6 again** — it is
> a `git filter-repo` history rewrite followed by a force-push, and re-running
> it against the current history would rewrite every commit made since for no
> reason. Step 1 is still worth reading if the Cloudinary credentials ever need
> to be recreated or rotated.
>
> The live, day-to-day part of this document starts at
> [How it works afterwards](#how-it-works-afterwards) — that is the section to
> read for pulling the channel, the `force` and `prune` inputs, and where the
> snapshots live.

---

## Before you start

You need a Cloudinary account (the free tier is enough) and about 20 minutes.
`git filter-repo` must be installed:

```bash
brew install git-filter-repo
```

---

## 1. Create the credentials

In the Cloudinary console:

- **Dashboard** → copy the **Cloud name** (e.g. `dxxxxxxxx`). This is public.
  It appears in every image URL the site serves.
- **Settings → API Keys** → copy the **API environment variable**, which looks
  like `CLOUDINARY_URL=cloudinary://123456789012345:abc...xyz@dxxxxxxxx`.
  The part after the colon is a **secret**.

## 2. Put them in GitHub

Repository → **Settings** → **Secrets and variables** → **Actions**:

| Where             | Name               | Value                                 |
| ----------------- | ------------------ | ------------------------------------- |
| **Variables** tab | `CLOUDINARY_CLOUD` | just the cloud name, e.g. `dxxxxxxxx` |
| **Secrets** tab   | `CLOUDINARY_URL`   | the whole `cloudinary://...` string   |

They are split deliberately. The cloud name is baked into the static build and
is visible in page source; the API secret is only ever read by the sync
workflows and never reaches the browser.

> Do not paste the API secret into a chat, an issue, or a commit. If it leaks,
> rotate it in **Settings → API Keys**.

For local runs, put the same line in `.env.local` (gitignored):

```
CLOUDINARY_URL=cloudinary://...
NEXT_PUBLIC_CLOUDINARY_CLOUD=dxxxxxxxx
```

## 3. Populate Cloudinary from the branch

**Do this before merging.** Until a sync has run, `data/photos.json` does not
exist in Cloudinary, the loader treats the 404 as "never synced", and the
gallery renders empty. Running the sync against the branch closes that window.

Actions → **Sync Telegram photos** → **Run workflow** → select
`feat/photos-cloudinary` → Run.

Expected output:

```
→ cloudinary cloud: dxxxxxxxx
→ 0 photos already uploaded
→ reading t.me/s/just_my_photos
  page 1: 20 posts, 34 photos
  ...
→ re-hosting photos
  400 uploaded, 0 already in Cloudinary
✓ 400 photos written to data/photos.json in Cloudinary
```

It commits nothing; the snapshot goes to Cloudinary. **This is the first
time the upload path runs anywhere** — it could not be tested from the
development sandbox, which cannot reach `api.cloudinary.com`. Read the log
rather than trusting the green tick.

If it fails:

- `CLOUDINARY_URL is not set` — the secret is on the wrong tab, or named
  differently.
- `CLOUDINARY_URL is malformed` — a stray quote or newline; re-copy it.
- `Server returned unexpected status code - 401` — wrong key or secret.
- `t.me returned 403` — Telegram is rate-limiting the runner. Wait and re-run;
  the run is resumable because uploads are keyed on the message id.

## 4. Check the branch actually renders

Pull the branch and build it the way CI does:

```bash
git pull
NEXT_PUBLIC_BASE_PATH=/Personal_WebSite \
NEXT_PUBLIC_CLOUDINARY_CLOUD=dxxxxxxxx \
npm run build
npx serve out   # or open out/en/photos/index.html
```

Confirm: photos load, they come from `res.cloudinary.com`, and
`public/images/` does not exist. Then open the Cloudinary **Media Library** and
confirm a `telegram/images/` folder with ~400 assets named `<postId>-<slot>`.

## 5. Merge

Open the PR, review, merge to `main`. `deploy.yml` publishes. Check the live
site before continuing — **step 6 is much harder to undo after this point.**

The deployed artifact should now be ~3 MB rather than ~830 MB.

## 6. Purge the images from history

Deleting the files in step 5 removed them from the working tree, not from
history: every old commit still contains them, so a fresh clone still
downloads ~64 MB of dead image blobs. This step removes them permanently.

**This rewrites every commit hash. Anyone with a clone must re-clone.** For
this repository that is you, on however many machines.

```bash
# From a fresh, full clone — filter-repo refuses to run on a dirty or
# shallow one, and you want the original left untouched as a safety net.
cd ~/Documents/Projects
git clone https://github.com/sergei-butko/Personal_WebSite.git purge-tmp
cd purge-tmp

# See what is about to go.
git filter-repo --analyze
head -30 .git/filter-repo/analysis/path-all-sizes.txt

# Remove the directory from every commit that ever contained it.
git filter-repo --path public/images/ --invert-paths --force

# filter-repo drops the remote on purpose, so a rewrite cannot be pushed by
# accident. Add it back deliberately.
git remote add origin https://github.com/sergei-butko/Personal_WebSite.git

# Confirm before pushing.
du -sh .git                       # expect a few MB, was 64 MB
git log --oneline | wc -l         # same commit count as before
git log --all --diff-filter=A --name-only -- 'public/images/*' | head   # expect nothing

git push --force --all
git push --force --tags
```

Then, on every machine:

```bash
cd ~/Documents/Projects
mv Personal_WebSite Personal_WebSite.old
git clone https://github.com/sergei-butko/Personal_WebSite.git
```

Delete `Personal_WebSite.old` and `purge-tmp` once you are satisfied — and not
before. The `.old` clone is the only copy of the pre-rewrite history.

### After the rewrite

- Open PRs are based on commits that no longer exist. Close and re-open them
  from re-clones. Right now there should be none.
- GitHub keeps the old objects reachable for a while; the repo's _displayed_
  size may not drop immediately. Content is gone from every branch regardless.
- The old image URLs (`/Personal_WebSite/images/photos/...`) are dead. Nothing
  in the repo references them, but a bookmark or a search-engine result might.

---

## How it works afterwards

`sync-telegram.ts` uploads each photo to `telegram/images/<postId>-<slot>` and
writes the snapshot to `data/photos.json`, in the same Cloudinary account.
`sync-threads.ts` does the same to `threads/images/<postId>-<slot>` and
`data/threads.json`. Neither writes to the repository. The public id is derived from a stable source id, so
a re-run **replaces** an asset rather than adding one — which is precisely what
the previous implementation got wrong.

`lib/media.ts` builds delivery URLs with `f_auto,q_auto,c_limit,w_<n>`.
Cloudinary picks AVIF or WebP per browser and derives each width on demand, so
there is no encode step and no variant files.

`/public/images/` is gitignored. If it reappears locally, something ran an old
script — nothing in the tree writes there any more.

### The layout, and the two fields that decide it

| Folder             | Holds                    | Named                 |
| ------------------ | ------------------------ | --------------------- |
| `telegram/images/` | Channel photos           | `<postId>-<slot>`     |
| `telegram/audio/`  | The song under each post | `<audioPostId>`       |
| `threads/images/`  | Bottle shots             | `<Brand>-<Scent>-<n>` |
| `data/`            | The three JSON snapshots | `<name>.json`         |

**An asset's folder is not its public id.** This cloud is in Cloudinary's
_dynamic folder_ mode, where `asset_folder` — what the Media Library groups by
— is a separate field from `public_id`, which is what the delivery URL is built
from. Neither `uploader.upload` nor `uploader.rename` sets it, so for a long
time every asset these scripts uploaded sat in the ROOT of the Media Library,
653 of them in one list, while its id said `telegram/…`. Only
`uploader.explicit` writes it; `asset_folder` and `to_asset_folder` are not
honoured as rename options, and both were tried.

`api.update` also writes it and is the obvious call — do not use it here. It is
an **Admin API** request, and the free plan allows 500 of those an hour, fewer
than the 651 assets a full run touches. `uploader.explicit` is an Upload API
request and is not on that budget.

### Deleting what nothing references: `MEDIA_PRUNE=1`

    SYNC_DRY_RUN=1 MEDIA_PRUNE=1 npm run media:organise   # list, delete nothing
    MEDIA_PRUNE=1 npm run media:organise                  # delete

Editing a post's image list or deleting a post leaves its assets behind.
`media:organise` reports them on every run; this removes them.

Only assets under `telegram/` and `threads/` are ever candidates. The snapshots
in `data/`, Cloudinary's own demo files at the root (`sample`, `cld-sample-*`,
`main-sample`) and anything else outside those two namespaces are never touched,
whatever the flag says. Old prefixes count deliberately: an unreferenced asset
was never renamed — a rename is only planned for something a snapshot points at
— so these sit at `threads/<postId>-<slot>` rather than under
`threads/images/`, and matching on the folder would find none of them.

**Opt-in because it is irreversible in a way the photo prune is not.** A Telegram
photo can be fetched from the channel again — that is what `SYNC_REPAIR` does —
but Meta's media URLs are signed and expire, so a deleted Threads image is gone
for good. Read the list it prints first; it prints all of them, never a
truncated sample, because that log is the only record of what went.

17 were removed on 2026-08-31: five second images dropped from Kajal and Dior
posts by hand, and twelve belonging to posts no longer in the snapshot.

### Repairing a row whose asset is gone: `SYNC_REPAIR=1`

    SYNC_REPAIR=1 SYNC_DRY_RUN=1 npm run sync:photos   # what is missing
    SYNC_REPAIR=1 npm run sync:photos                  # re-fetch and re-upload

A photo row can lose its Cloudinary asset without anything being wrong with the
sync — an upload that failed years ago, a deletion in the console. The sync will
never notice on its own, because it appends only posts newer than the cursor and
so never looks at a 2019 row again. `media:organise` is what surfaces them, and
this is what fixes them: the channel walk already fetches the whole history, so
the bytes are in hand; the flag is only permission to touch a row that would
otherwise be skipped. It re-uploads what is actually absent, unlike `SYNC_FORCE`,
which re-uploads all 443 photos to fix one.

It also purges dedup entries naming a missing asset, and that is not
housekeeping. `decideAsset` is handed "hash → public id" and must trust it; it
cannot know an id is dead. The first attempt at this repair found the missing
photo's hash in the map, concluded the bytes were already stored under the very
id that was missing, and pointed the row back at nothing — reporting a repair
and changing nothing at all.

A row whose post has since been deleted from the channel cannot be repaired.
The script says so and leaves it; remove it by hand with `content:pull` /
`content:push`.

### Renaming bottles: `npm run media:organise`

    SYNC_DRY_RUN=1 npm run media:organise   # print the plan, touch nothing
    npm run media:organise                  # do it

A Threads image arrives as `threads/images/<postId>-<slot>`, because the
fragrance is hand-written and **does not exist when the sync runs** — Serhii
names the bottle afterwards through `content:pull` / `content:push`. This
command is the second half: it renames each image after the bottle its post
names, files everything in the table above, and rewrites the three snapshots to
match.

Run it after naming bottles. It is idempotent — a second run reports nothing to
do — and it is safe to interrupt: the snapshots are written once, at the very
end, only after every rename has returned, so a run that dies leaves the site
pointing exactly where it did and the next run finishes the job.

`media-name.ts` holds the naming rules and `npm run test:names` pins them.
Diacritics fold (`Wūlóng Chá` → `Wulong_Cha`), apostrophes vanish
(`Sister's Aroma` → `Sisters_Aroma`), and `-` never appears inside a field
because it separates them (`Marc-Antoine Barrois` → `Marc_Antoine_Barrois`).
A post with no bottle named keeps its post id.

**Renaming changes delivery URLs, so deploy straight afterwards.** The
published HTML is static and holds the old ids; until it is rebuilt those
images 404.

### Distinctness

Images are deduplicated by **sha256 of the file bytes**, recorded in
`data/photo-hashes.json` in Cloudinary. The same photo posted to the channel
twice produces two entries in the snapshot — both posts are real and both
appear in the gallery — but only one Cloudinary asset.

It cannot be deduplicated by URL: Telegram signs its CDN URLs and they differ
per fetch for identical images. That is the mistake the first implementation
made, and `npm run test:dedup` now pins the rule.

### The song attached to a post

The channel posts a track a few seconds after the album it goes with, and the
by-post view shows it under the photos with a player. Two separate things have
to work for that, and only the first is automatic.

**Title and artist are free.** `t.me/s/<channel>` renders an audio message as a
card with the track title and the performer on it, and `pairAudio` in
`telegram-parse.ts` binds each song to the post directly before it in message
order. That happens on every sync with no configuration, and a track with no
file still renders — as the same card, linking out to Telegram.

**The audio file needs a bot.** Telegram serves audio to nobody who is not
logged in: there is no file URL in the markup on `/s/` or on `?embed=1`, unlike
photos and videos. And the Bot API has no "read message N of channel C" — a bot
only sees messages that arrive as updates, and updates expire after 24 hours.
What does work is `forwardMessage`, whose response is the full message object
with the `file_id` in it. So the sync forwards each track into a private chat,
reads the id off the reply, downloads the file, uploads it to
`telegram/audio/<messageId>`, and deletes the forwarded copy again.

To turn it on:

1. Message [@BotFather](https://t.me/BotFather), `/newbot`, and keep the token.
2. Add the bot to **@just_my_photos** as an administrator. It needs no
   permissions — membership is what allows the forward.
3. Open a chat with your own new bot and press **Start**. A bot cannot message
   a person who has never started it, and the forward has to land somewhere.
4. Message [@userinfobot](https://t.me/userinfobot); it replies with your
   numeric user id. That is `TELEGRAM_AUDIO_CHAT` — your own DM with the bot.
   (A private channel works too, and its id looks like `-1001234567890`. The DM
   is simply one less thing to create; the forwards are deleted either way, so
   nothing accumulates in it.)
5. Add two repository secrets: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_AUDIO_CHAT`.
   Or, to run it from this machine instead, add both to `.env` alongside
   `CLOUDINARY_URL` and run `npx tsx --env-file=.env scripts/sync-telegram.ts`.
   Every `.env*` is gitignored, so neither ends up in the repo.

Every run prints which state it is in — `bot download configured`, `off (no
TELEGRAM_BOT_TOKEN)`, or `INCOMPLETE` when one secret is set without the other —
followed by how many songs came back with a playable file. A track that cannot
be fetched (a forward the channel refuses, a file over the Bot API's 20 MB
download ceiling) is logged and skipped; it keeps its title and artist and the
card links to Telegram instead.

The **first** run with the secrets in place fetches every song in the channel's
history, not just new ones: the existing snapshot predates this feature, so
every photo row is missing its track. That is the one case where a sync edits a
row it has already captured, and it is additive only — a row that already names
a song is never touched, hand-edited or not.

Prune does not touch audio. Cloudinary files sound under its `video` resource
type, which `listAssetIds` does not enumerate, so an orphaned track stays.
Deliberate: it is a few megabytes, and the Bot API may not be able to re-fetch
what a prune removed.

### Trying a sync without writing anything

```bash
SYNC_DRY_RUN=1 npm run sync:photos
```

Fetches, parses, pairs the songs and reports what it would do, then stops before
every upload and the prune. Useful before a first run against a live snapshot,
and the reason the script can be run at all without touching the content store.

### Pulling the whole channel

There is no photo cap by default any more. It used to default to 400, the
channel has more, and because the walk runs newest-first the cap silently
dropped the **oldest** photos — everything before message 38.

To re-pull the whole channel and collapse any duplicates:

Actions → **Sync Telegram photos** → **Run workflow**, and tick:

- **force** — re-download and re-hash every photo, ignoring both caches.
  Required for the first run, because photos uploaded before hashing existed
  have no recorded hash and cannot be matched otherwise.
- **prune** — delete Cloudinary assets the new snapshot does not reference.
  This is the only destructive option in the sync. It lists every id before
  deleting it; read the log.

Run it with **force** alone first if you want to see what prune would remove
before removing it — the `N photos → M distinct assets` line tells you how many
duplicates were found.

Afterwards, leave both unticked. There is no schedule — the sync runs only when
you start it — so this is also how you pull new photos day to day: Run workflow,
nothing ticked. It uploads only if the channel actually changed, and then
dispatches `deploy.yml` itself. Untick **deploy** to refresh Cloudinary without
republishing the site.

### Re-uploading everything from a shell

```bash
node --env-file=.env -e "process.exit(0)"   # confirm .env parses
SYNC_FORCE=1 npm run sync:photos
```

`tsx` does not read `.env` the way `next build` does, so export the variables
or use `--env-file` when running by hand.

### Free-tier headroom

400 photos of a few hundred KB each is well inside the free tier's storage.
The limit worth watching is monthly **transformations** — each new
width/format combination counts once, then it is cached at the CDN. If the
site ever gets real traffic, check **Dashboard → Usage** rather than guessing.

---

## Where the snapshots live

| Asset                    | Written by     | Read by                                 |
| ------------------------ | -------------- | --------------------------------------- |
| `data/photos.json`       | `sync:photos`  | `lib/photos/snapshot.ts` at build time  |
| `data/photo-hashes.json` | `sync:photos`  | `sync:photos` on the next run           |
| `data/threads.json`      | `sync:threads` | `lib/threads/snapshot.ts` at build time |

They are `raw` assets, publicly readable at
`https://res.cloudinary.com/<cloud>/raw/upload/<id>`. That is fine — every byte
in them is already public, being a mirror of a public channel and public posts.

The build fetches them with a per-process cache-buster, because Cloudinary's
CDN will otherwise serve the previous version of an overwritten raw asset for a
while, and a deploy running seconds after a sync is exactly that race.

**This is a build-time network dependency**, which the repo otherwise avoids.
A Cloudinary outage means you cannot deploy — but the already-deployed site
keeps serving, since it is static HTML on Pages. The alternative was committing
the snapshots, which is what produced the sync commits this design removes.
