# Setting up the Threads sync

Everything on the code side is built. What's left needs your Meta account, and
can't be done by anyone else. Budget about 20 minutes.

At the end of this you'll have a `THREADS_ACCESS_TOKEN` repository secret, and
the site will pull your Threads posts every six hours on its own.

---

## What you're building

A Meta developer app that exists solely so _you_ can read _your own_ posts.
Nobody else ever uses it, it is never published, and it never needs App Review
— that's only required when strangers grant your app permissions.

---

## 1. Create the app

1. Go to **https://developers.facebook.com/apps** → **Create app**
2. App name: anything (`personal-website-sync` is fine). Not user-visible.
3. Use case: **Access the Threads API**
4. Create it.

## 2. Add yourself as a Threads tester

In the app dashboard → **App roles → Roles** → **Add people** → **Threads
tester** → your own Threads account.

Then accept the invitation at
**https://www.threads.com/settings/account** → _Website permissions_ →
_Invites_. It will not work until you accept.

## 3. Note the app secret

App dashboard → **App settings → Basic** → **App secret** → _Show_.

Keep it in your password manager. You need it once, in step 5.

## 4. Get a short-lived token

App dashboard → **Use cases → Access the Threads API → Customise** →
make sure **`threads_basic`** is added. That's the only permission needed for
reading. Don't add publishing permissions you won't use.

Then use the **Graph API Explorer** / _Generate access token_ button for your
Threads tester account, granting `threads_basic`.

This token lasts **one hour**. Move to step 5 promptly.

## 5. Exchange it for a long-lived token

In the repo, locally:

```bash
export THREADS_APP_SECRET='<the app secret from step 3>'
npm run threads:exchange -- '<the short-lived token from step 4>'
```

It prints a token valid for **60 days** and tells you when it expires.

## 6. Store it as a repository secret

**Repo → Settings → Secrets and variables → Actions → New repository secret**

- Name: `THREADS_ACCESS_TOKEN`
- Value: the long-lived token from step 5

## 7. Run the first sync

**Actions → Sync Threads → Run workflow.**

It fetches your posts, downloads and re-encodes the images to AVIF and WebP,
writes `src/content/threads.generated.ts`, and commits. That commit triggers a
deploy, and the posts appear at `/en/threads/` and `/uk/threads/`.

---

## Keeping the token alive

Long-lived tokens last 60 days and **die permanently** if not refreshed inside
that window. Two ways to handle it:

**Manual (default, no extra credentials).** Do nothing now. When the token
eventually expires, the scheduled sync fails and GitHub emails you about the
failed run. Then:

```bash
npm run threads:refresh -- '<current token>'
```

and update the `THREADS_ACCESS_TOKEN` secret with the new value. The site keeps
working the whole time — it just stops picking up new posts.

**Automatic (optional).** `.github/workflows/refresh-threads-token.yml`
refreshes weekly, but needs a second secret because `GITHUB_TOKEN` isn't
allowed to write secrets:

- Create a **fine-grained PAT** scoped to **this repository only**, with
  **Secrets: read and write**
- Store it as the `GH_SECRETS_PAT` repository secret

If that secret is absent, the workflow skips itself harmlessly. Setting it up
means a long-lived credential lives in your repo secrets — a real trade, which
is why it isn't the default.

---

## Alt text, and why the gallery may be quiet for screen readers

Threads doesn't require alt text, so most posts arrive without it. The rule the
site applies, in `ThreadsPostCard.tsx`:

1. Your `alt_text` from Threads, if you wrote one — always wins.
2. If not, but the post has body text: `alt=""`. This is correct, not lazy —
   the text is right there, and duplicating it makes screen readers repeat
   themselves.
3. If neither: a generic fallback, because an image-only post with no alt is a
   real accessibility gap and silence would hide it.

Only case 3 is unsatisfying, and the only real fix is writing alt text when you
post on Threads.

---

## Troubleshooting

**`Could not read username`** — the token is invalid, expired, or
`threads_basic` was never granted. Redo steps 4–6.

**`No usable posts returned`** — the script refuses to overwrite a good
snapshot with an empty one. Check the tester invitation from step 2 was
actually accepted.

**Sync succeeds but nothing changes on the site** — expected when the feed
hasn't changed. The script deliberately produces no git diff in that case, so
the repo isn't churned every six hours.

**Images 404 after a while** — shouldn't happen: images are downloaded into
`public/images/threads`, never hotlinked from Meta's CDN, whose URLs are signed
and expire. If it does, the download step silently failed; check the sync log.
