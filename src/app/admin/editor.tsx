'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * The editor.
 *
 * Reads come straight from Cloudinary's CDN — the snapshots are public raw
 * assets, so there is no reason to proxy them. Only writes go to /api, because
 * only writes need the Cloudinary secret.
 *
 * There is no token here, deliberately. The session is an httpOnly cookie the
 * browser attaches to same-origin requests on its own, which no script on this
 * page can read — including any script that should not be here.
 *
 * Saves send PATCHES, never the whole document: a sync may append a post while
 * this page is open, and sending everything back would erase it. Only fields
 * the user actually changed are transmitted, and the Worker applies them to a
 * freshly fetched copy.
 */

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? ''

interface ThreadsPost {
  id: string
  permalink: string
  timestamp: string
  text: string
  images: { publicId: string; width: number; height: number; alt: string }[]
}

interface Photo {
  id: number
  publicId: string
  permalink: string
  timestamp: string
  caption: string
  alt: { en?: string; uk?: string }
  hidden?: boolean
  width: number
  height: number
}

type Tab = 'threads' | 'photos'

function thumb(publicId: string, width = 160): string {
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,c_limit,w_${width}/${encodeURI(publicId)}`
}

async function loadSnapshot<T>(name: string): Promise<T | null> {
  const response = await fetch(
    `https://res.cloudinary.com/${CLOUD}/raw/upload/data/${name}.json?v=${Date.now()}`
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
  return (await response.json()) as T
}

export function Editor() {
  const [login, setLogin] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('threads')
  const [posts, setPosts] = useState<ThreadsPost[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  // Edits held here until saved, keyed by record id. Nothing is written on
  // keystroke: a save is a network round trip that rewrites a shared document.
  const [postEdits, setPostEdits] = useState<Record<string, string>>({})
  const [photoEdits, setPhotoEdits] = useState<
    Record<
      string,
      { caption?: string; alt?: { en?: string; uk?: string }; hidden?: boolean }
    >
  >({})

  useEffect(() => {
    void fetch('/api/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { login?: string } | null) => setLogin(body?.login ?? null))
      .catch(() => setLogin(null))
  }, [])

  useEffect(() => {
    if (!CLOUD) return
    Promise.all([
      loadSnapshot<{ posts: ThreadsPost[] }>('threads'),
      loadSnapshot<{ photos: Photo[] }>('photos'),
    ])
      .then(([t, p]) => {
        setPosts(t?.posts ?? [])
        setPhotos(p?.photos ?? [])
      })
      .catch((e: unknown) => setError((e as Error).message))
  }, [])

  const dirtyCount = Object.keys(postEdits).length + Object.keys(photoEdits).length

  const save = useCallback(async () => {
    if (dirtyCount === 0) return
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const body = {
        threads: Object.fromEntries(
          Object.entries(postEdits).map(([id, text]) => [id, { text }])
        ),
        photos: photoEdits,
      }
      const response = await fetch('/api/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = (await response.json()) as Record<string, { applied?: number }> & {
        error?: string
      }
      if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`)

      const applied = (result.threads?.applied ?? 0) + (result.photos?.applied ?? 0)
      setPostEdits({})
      setPhotoEdits({})
      setStatus(
        applied === 0
          ? 'Nothing to change — the stored copy already matched.'
          : `Saved ${applied} record${applied === 1 ? '' : 's'}. Run Deploy to publish.`
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [dirtyCount, postEdits, photoEdits])

  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? posts.filter((p) => p.text.toLowerCase().includes(q)) : posts
  }, [posts, query])

  const visiblePhotos = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? photos.filter(
          (p) =>
            p.caption.toLowerCase().includes(q) || p.publicId.toLowerCase().includes(q)
        )
      : photos
  }, [photos, query])

  if (!CLOUD) {
    return (
      <Shell>
        <p className="text-sm text-muted">
          Not configured. This page needs <Code>NEXT_PUBLIC_CLOUDINARY_CLOUD</Code> at
          build time. See <Code>netlify/README.md</Code>.
        </p>
      </Shell>
    )
  }

  if (!login) {
    return (
      <Shell>
        <p className="mb-4 text-sm text-muted">
          Editing writes to the live content store. Sign in to continue.
        </p>
        {/* Not next/link: /api/* is an edge function, and a client-side
            navigation would never reach the server. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/auth/login?redirect=%2Fadmin%2F"
          className="inline-block rounded-[var(--radius-card)] border border-edge bg-surface px-4 py-2 text-sm transition hover:border-accent"
        >
          Sign in with GitHub
        </a>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {(['threads', 'photos'] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              tab === name
                ? 'border-accent text-ink'
                : 'border-edge text-muted hover:border-accent'
            }`}
          >
            {name === 'threads' ? `Posts (${posts.length})` : `Photos (${photos.length})`}
          </button>
        ))}

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter…"
          className="min-w-40 flex-1 rounded-[var(--radius-card)] border border-edge bg-surface px-3 py-1.5 text-sm"
        />

        <span className="font-mono text-[10.5px] text-muted">
          @{login} · {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/auth/logout" className="transition hover:text-ink">
            sign out
          </a>
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={dirtyCount === 0 || saving}
          className="rounded-[var(--radius-card)] border border-edge bg-surface px-4 py-1.5 text-sm transition enabled:hover:border-accent disabled:opacity-40"
        >
          {saving ? 'Saving…' : dirtyCount === 0 ? 'Saved' : `Save ${dirtyCount}`}
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-[var(--radius-card)] border border-dashed border-edge p-3 text-sm text-ink">
          {error}
        </p>
      ) : null}
      {status ? <p className="mb-4 text-sm text-muted">{status}</p> : null}

      {tab === 'threads' ? (
        <div className="flex flex-col gap-4">
          {visiblePosts.map((post) => {
            const value = postEdits[post.id] ?? post.text
            return (
              <article
                key={post.id}
                className="rounded-[var(--radius-card)] border border-edge bg-surface p-4"
              >
                <div className="mb-2 flex items-center gap-3 font-mono text-[10.5px] text-muted">
                  <time dateTime={post.timestamp}>{post.timestamp.slice(0, 10)}</time>
                  <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                    source
                  </a>
                  {postEdits[post.id] !== undefined ? (
                    <span className="text-accent">edited</span>
                  ) : null}
                </div>
                <textarea
                  value={value}
                  rows={Math.min(18, Math.max(4, value.split('\n').length + 1))}
                  onChange={(event) => {
                    const next = event.target.value
                    setPostEdits((current) => {
                      // Reverting to the stored value drops the edit entirely,
                      // so the save count reflects real changes.
                      const updated = { ...current }
                      if (next === post.text) delete updated[post.id]
                      else updated[post.id] = next
                      return updated
                    })
                  }}
                  className="w-full resize-y rounded-[var(--radius-card)] border border-edge bg-bg p-3 text-[14px] leading-relaxed"
                />
                {post.images.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.images.map((image) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={image.publicId}
                        src={thumb(image.publicId, 120)}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-edge object-cover"
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visiblePhotos.map((photo) => {
            const edit = photoEdits[photo.publicId] ?? {}
            const caption = edit.caption ?? photo.caption
            const altEn = edit.alt?.en ?? photo.alt.en ?? ''
            const altUk = edit.alt?.uk ?? photo.alt.uk ?? ''
            const hidden = edit.hidden ?? Boolean(photo.hidden)

            const update = (change: Partial<typeof edit>) =>
              setPhotoEdits((current) => ({
                ...current,
                [photo.publicId]: { ...current[photo.publicId], ...change },
              }))

            return (
              <article
                key={photo.publicId}
                className="flex gap-3 rounded-[var(--radius-card)] border border-edge bg-surface p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb(photo.publicId, 160)}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-lg border border-edge object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-3 font-mono text-[10.5px] text-muted">
                    <span className="truncate">{photo.publicId}</span>
                    <a href={photo.permalink} target="_blank" rel="noopener noreferrer">
                      source
                    </a>
                    <label className="ml-auto flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={hidden}
                        onChange={(event) => update({ hidden: event.target.checked })}
                      />
                      hidden
                    </label>
                  </div>
                  <input
                    value={caption}
                    placeholder="Caption"
                    onChange={(event) => update({ caption: event.target.value })}
                    className="rounded-[var(--radius-card)] border border-edge bg-bg px-2 py-1.5 text-sm"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={altEn}
                      placeholder="Alt (EN)"
                      onChange={(event) =>
                        update({ alt: { ...edit.alt, en: event.target.value } })
                      }
                      className="flex-1 rounded-[var(--radius-card)] border border-edge bg-bg px-2 py-1.5 text-sm"
                    />
                    <input
                      value={altUk}
                      placeholder="Alt (UK)"
                      onChange={(event) =>
                        update({ alt: { ...edit.alt, uk: event.target.value } })
                      }
                      className="flex-1 rounded-[var(--radius-card)] border border-edge bg-bg px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </Shell>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px]">{children}</code>
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <h1 className="mb-1 text-lg font-medium">Editor</h1>
      <p className="mb-6 font-mono text-[10.5px] text-muted">
        Edits the live content store. Publishing still needs a Deploy run.
      </p>
      {children}
    </main>
  )
}
