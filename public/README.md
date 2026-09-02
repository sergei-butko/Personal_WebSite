# Brand assets

The only images in this repository. Everything else the site shows — 443
photographs and 187 bottle shots — lives in Cloudinary and is fetched at build
time; see `docs/RUNBOOK-CLOUDINARY.md`.

These four are different in kind. They are site chrome rather than content:
hand-drawn, changed almost never, and on every page including `/about`, `/cv`
and `/links`, which otherwise make no external request at all. A favicon in
particular has to be a file, because Next's `app/icon.png` convention is what
generates the `<link rel="icon">` tags.

| File                       | Rendered as                 | Source in Cloudinary |
| -------------------------- | --------------------------- | -------------------- |
| `src/app/icon.png`         | Browser tab icon            | `public/small`       |
| `src/app/apple-icon.png`   | iOS home-screen icon        | `public/small`       |
| `public/logo-mark.png`     | Header, beside the name     | `public/main`        |
| `public/logo-wordmark.png` | Footer, above the copyright | `public/full`        |

`src/app/icon.png` and `src/app/apple-icon.png` are **file conventions, not
imports** — Next finds them by name and emits the tags itself. Do not reference
them by path.

## Regenerating them

The originals stay in Cloudinary's `public/` folder at full size; what is
committed here is downscaled, because the header renders a 500×500 PNG at 28
pixels and shipping 218 KB to do it would be silly. The four together are 42 KB
where the originals are 659 KB.

    npx tsx - <<'TS'
    import sharp from 'sharp'
    const at = (id: string) => `https://res.cloudinary.com/<cloud>/image/upload/${id}.png`
    const get = async (id: string) => Buffer.from(await (await fetch(at(id))).arrayBuffer())
    const png = { compressionLevel: 9, effort: 10 } as const
    for (const [id, out, w, h] of [
      ['small', 'src/app/icon.png', 96, 96],
      ['small', 'src/app/apple-icon.png', 180, 180],
      ['main', 'public/logo-mark.png', 96, 96],
      ['full', 'public/logo-wordmark.png', 400, null],
    ] as const) {
      await sharp(await get(id)).resize(w, h ?? undefined).png(png).toFile(out)
    }
    TS

Each is sized for a 3× display of where it is used, which is why the mark is 96
square for a 28-pixel slot.

Cloudinary's `public/` folder also holds `Codex_Image_…`, the sheet the three
were cut from. It is the source artwork, not an asset — nothing references it.
