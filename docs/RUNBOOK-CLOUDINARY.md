# Moving images out of git

Photos and Threads images are re-hosted in Cloudinary. Nothing but the
generated snapshots is in the repository.

Run these steps in order. Steps 1–4 are reversible. **Step 6 rewrites history
and is not.**

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

**Do this before merging.** The migration ships an empty photo snapshot — see
the comment in `src/content/photos.generated.ts` for why hand-writing the ids
would be worse — so `main` would show an empty gallery in the window between
merge and the first sync. Running the sync against the branch closes that
window.

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
✓ 400 photos written to src/content/photos.generated.ts
```

It commits the regenerated snapshot back to the branch. **This is the first
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
confirm a `telegram/` folder with ~400 assets named `<postId>-<slot>`.

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

`sync-telegram.ts` uploads each photo to `telegram/<postId>-<slot>` and writes
only `src/content/photos.generated.ts`. `sync-threads.ts` does the same to
`threads/<postId>-<slot>`. The public id is derived from a stable source id, so
a re-run **replaces** an asset rather than adding one — which is precisely what
the previous implementation got wrong.

`lib/media.ts` builds delivery URLs with `f_auto,q_auto,c_limit,w_<n>`.
Cloudinary picks AVIF or WebP per browser and derives each width on demand, so
there is no encode step and no variant files.

`/public/images/` is gitignored. If it reappears locally, something ran an old
script — nothing in the tree writes there any more.

### Re-uploading everything

The snapshot doubles as the upload cache. To force a full re-upload:

```bash
SYNC_FORCE=1 npm run sync:photos
```

### Free-tier headroom

400 photos of a few hundred KB each is well inside the free tier's storage.
The limit worth watching is monthly **transformations** — each new
width/format combination counts once, then it is cached at the CDN. If the
site ever gets real traffic, check **Dashboard → Usage** rather than guessing.
