# Setting up the Threads sync

Everything on the code side is built. What's left needs your Meta account, and
can't be done by anyone else. Budget about 20 minutes.

At the end of this you'll have a `THREADS_ACCESS_TOKEN` repository secret, and
a **Sync Threads** workflow you run by hand whenever you want the site to pick
up new posts. There is no schedule and no sync commit: the snapshot is a JSON
asset in Cloudinary, and the workflow triggers the deploy itself.

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

## 3. Note the _Threads_ app secret

App dashboard → **Use cases → Access the Threads API → Customise → Settings**.
Below the permissions list are **Threads App ID** and **Threads App secret**;
press _Show_ on the secret.

These are not the same as the Facebook App ID and App secret on **App settings
→ Basic**. `th_exchange_token` rejects the Facebook secret, and the error does
not say why. Basic sometimes mirrors the Threads pair and sometimes shows
nothing — the use-case Settings tab always has them, so use that.

No **Settings** tab there means the use case was never added: **Use cases →
Add use case → Access the Threads API**. An app created as Business, Consumer
or Other has no Threads credentials until then.

Keep the secret in your password manager. You need it once, in step 5.

## 4. Get a short-lived token

App dashboard → **Use cases → Access the Threads API → Customise** →
make sure both of these are added:

- **`threads_basic`** — required by every endpoint.
- **`threads_read_replies`** — required to read the replies edge. The sync uses
  it to pick up the follow-up comment on two-part reviews; without it those
  posts mirror as their first half only.

On the same screen, fill in **Redirect Callback URLs** if it is empty — any
URL you control will do (`https://sergei-butko.github.io/Personal_WebSite/` is
fine). Nothing ever redirects there; the form refuses to save without it.

Then scroll to **User token generator**, find your tester account, and press
**Generate token**. Approve the `threads_basic` prompt.

Do _not_ reach for the Graph API Explorer — it talks to `graph.facebook.com`
and the Threads API lives on `graph.threads.net`. Tokens minted there do not
work here.

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

It fetches your posts, re-hosts the images in Cloudinary under
`threads/<postId>-<slot>`, and writes the snapshot to `data/threads.json`
there as well. Nothing is committed. When the run finishes it dispatches
`deploy.yml`, and the posts appear at `/en/threads/` and `/uk/threads/`.

Leave the **deploy** input ticked unless you want to refresh Cloudinary
without republishing the site.

The workflow already passes the `CLOUDINARY_URL` secret, which the photo sync
uses too — nothing extra to set up. But the **deploy** needs
`CLOUDINARY_CLOUD` under Settings → Secrets and variables → Actions →
**Variables** (not Secrets). The build fetches its content snapshots from
Cloudinary, so without it the build fails outright.

---

## Keeping the token alive

Long-lived tokens last 60 days and **die permanently** if not refreshed inside
that window. Two ways to handle it:

**Manual (default, no extra credentials).** Do nothing now. When the token
eventually expires, the next sync you run fails with a token error. Then:

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

**`Invalid parameter` (code 100) from `threads:exchange`** — not a token
problem; code 190 is what a bad token gives. Either `THREADS_APP_SECRET` is
the Facebook app secret instead of the Threads one (step 3), or the token is
already long-lived — the dashboard generator sometimes issues 60-day tokens
directly, in which case skip step 5 and store it as-is.

**`Could not read username`** — the token is invalid, expired, or
`threads_basic` was never granted. Redo steps 4–6.

**`No usable posts returned`** — the script refuses to overwrite a good
snapshot with an empty one. Check the tester invitation from step 2 was
actually accepted.

**Sync succeeds but nothing changes on the site** — expected when the feed
hasn't changed. The script compares against the snapshot already in Cloudinary
(ignoring its timestamp) and uploads nothing when they match.

**Images 404 after a while** — shouldn't happen: image bytes are re-hosted in
Cloudinary, never hotlinked from Meta's CDN, whose URLs are signed and expire.
If it does, the upload step silently failed; check the sync log for `! image`
lines.

**Deploy fails with `NEXT_PUBLIC_CLOUDINARY_CLOUD is not set`** — the
`CLOUDINARY_CLOUD` repository _variable_ from step 7 is missing. `vars.` and
`secrets.` are separate namespaces; a secret with that name expands to empty.

**A video in a carousel is missing** — known and accepted. Only images are
re-hosted; video children are skipped with a warning and a video-only post
renders as text plus its permalink.
