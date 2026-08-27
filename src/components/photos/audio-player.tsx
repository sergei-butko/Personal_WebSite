'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostAudio } from '@/lib/photos/types'
import { formatDuration } from '@/lib/photos/format'

/**
 * The song posted with an album.
 *
 * Hand-built rather than `<audio controls>`: the native control bar is a
 * different size and shape in every browser, it cannot show a title, and at
 * the width of a card Safari's version alone is taller than the text beneath
 * it. The element is still a real `<audio>` underneath — this only replaces
 * its chrome.
 *
 * `preload="none"` is doing real work. The by-post page renders every album at
 * once and a good few carry a track; `metadata` would open a request per card
 * on load, for files a visitor has not asked to hear. So the duration shown
 * before the first play is the one Telegram reported at sync time, and the
 * element's own is used from the moment it knows better.
 *
 * With no file — a track the sync could not fetch — this is the same card
 * without a transport, linking out to Telegram. That is the honest rendering:
 * the song is part of the post either way, and hiding it would lose the only
 * record that there was one.
 */
export function AudioPlayer({
  audio,
  src,
  playLabel,
  pauseLabel,
  seekLabel,
  listenLabel,
}: {
  audio: PostAudio
  /** Cloudinary delivery URL, or undefined when the file was never fetched. */
  src: string | undefined
  playLabel: string
  pauseLabel: string
  seekLabel: string
  listenLabel: string
}) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  // `|| undefined` folds Telegram's 0 into "unknown", which renders as —:--
  // and is corrected the moment the browser reads the file's own metadata.
  // Without it a third of the tracks would claim to be zero seconds long.
  const [total, setTotal] = useState<number | undefined>(audio.duration || undefined)

  const toggle = useCallback(() => {
    const element = ref.current
    if (!element) return

    if (element.paused) {
      // One song at a time. Two cards playing over each other is never what a
      // second click meant, and the page can hold a dozen of these.
      for (const other of document.querySelectorAll('audio')) {
        if (other !== element) other.pause()
      }
      void element.play().catch(() => setPlaying(false))
    } else {
      element.pause()
    }
  }, [])

  // Driven by the element's own events, not by the click: a play() can be
  // refused, and another card pausing this one happens with no click at all.
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setElapsed(element.currentTime)
    const onMeta = () => {
      if (Number.isFinite(element.duration)) setTotal(element.duration)
    }
    const onEnded = () => {
      setPlaying(false)
      setElapsed(0)
    }

    element.addEventListener('play', onPlay)
    element.addEventListener('pause', onPause)
    element.addEventListener('timeupdate', onTime)
    element.addEventListener('loadedmetadata', onMeta)
    element.addEventListener('ended', onEnded)
    return () => {
      element.removeEventListener('play', onPlay)
      element.removeEventListener('pause', onPause)
      element.removeEventListener('timeupdate', onTime)
      element.removeEventListener('loadedmetadata', onMeta)
      element.removeEventListener('ended', onEnded)
    }
  }, [])

  const seek = useCallback((seconds: number) => {
    const element = ref.current
    if (!element) return
    element.currentTime = seconds
    setElapsed(seconds)
  }, [])

  const artist = audio.performer
  const progress = total && total > 0 ? (elapsed / total) * 100 : 0

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-edge bg-chip/60 px-2.5 py-2">
      {src ? (
        <>
          {/* No <track>: this is music, and a caption track for a song is not
              a thing that exists. The title and artist above are the label. */}
          <audio ref={ref} src={src} preload="none" />
          <button
            type="button"
            onClick={toggle}
            aria-label={`${playing ? pauseLabel : playLabel}: ${audio.title}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:opacity-90"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        </>
      ) : (
        <a
          href={audio.permalink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${listenLabel}: ${audio.title}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-edge text-muted transition hover:border-accent hover:text-ink"
        >
          <NoteIcon />
        </a>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] leading-tight font-medium">{audio.title}</p>
        {artist ? (
          <p className="truncate text-[11px] leading-tight text-muted">{artist}</p>
        ) : null}

        {src ? (
          <div className="mt-1.5 flex items-center gap-2">
            {/*
             * A range input, so dragging, arrow keys and a screen reader all
             * work without reimplementing any of them. It is styled down to a
             * 3px track in globals.css; the thumb stays a full-size target.
             */}
            <input
              type="range"
              min={0}
              max={total && total > 0 ? total : 100}
              step={0.5}
              value={elapsed}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label={`${seekLabel}: ${audio.title}`}
              className="audio-scrub h-1 min-w-0 flex-1"
              style={{ ['--played' as string]: `${progress}%` }}
            />
            <span className="shrink-0 font-mono text-[10px] text-muted tabular-nums">
              {formatDuration(elapsed)} / {formatDuration(total) || '—:--'}
            </span>
          </div>
        ) : (
          <a
            href={audio.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10.5px] text-muted underline underline-offset-2 transition hover:text-ink"
          >
            {listenLabel}
          </a>
        )}
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
      <path d="M5 3.2v9.6a.6.6 0 0 0 .92.5l7.2-4.8a.6.6 0 0 0 0-1l-7.2-4.8A.6.6 0 0 0 5 3.2Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
      <path d="M4.5 3h2.2v10H4.5zM9.3 3h2.2v10H9.3z" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="currentColor">
      <path d="M13 2.2a.6.6 0 0 0-.72-.59l-6 1.3a.6.6 0 0 0-.48.59v6.63a2.4 2.4 0 1 0 1.2 2.08V5.98l4.8-1.04v4.14a2.4 2.4 0 1 0 1.2 2.08Z" />
    </svg>
  )
}
