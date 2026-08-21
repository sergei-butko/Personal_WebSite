# sergei-butko.dev — personal site

Perfumery writing, photography, and engineering. Bilingual (EN / UK), statically
exported, deployed to GitHub Pages by Actions.

**Live:** https://sergei-butko.github.io/Personal_WebSite/

---

## Running it

```bash
nvm use          # Node 22, pinned in .nvmrc
npm install
npm run dev      # http://localhost:3000
```

`npm run dev` runs without a basePath, so local URLs are `/en/`, not
`/Personal_WebSite/en/`. That is intentional — the prefix is applied only in CI.

| Script                 | Does                                           |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Dev server                                     |
| `npm run build`        | Production build → static export in `out/`     |
| `npm run typecheck`    | `tsc --noEmit`                                 |
| `npm run lint`         | ESLint                                         |
| `npm run format`       | Prettier, writes                               |
| `npm run format:check` | Prettier, verifies only (this is what CI runs) |

---

## Where things live

```
src/
├── app/              routing only — a folder with page.tsx is a URL
│   ├── page.tsx      `/` locale detector
│   ├── not-found.tsx 404
│   └── [locale]/     every real page, generated for `en` and `uk`
├── components/
│   ├── blog/         post-card, post-list, tag-filter, fragrance-card
│   ├── photos/       gallery, image
│   ├── threads/      post-card, image
│   ├── links/        platform-icon
│   ├── layout/       header, footer, container, theme-toggle, locale-switcher
│   └── ui/           card, bento-grid, chip — dumb primitives
├── lib/
│   ├── blog/         posts, frontmatter, mdx, slug, types
│   ├── photos/       types, alt
│   ├── threads/      types
│   ├── links/        index, platforms
│   └── i18n · media · paths · types
└── content/          ← EDIT THIS. Everything you maintain by hand.
    ├── posts/        blog posts, <slug>.<locale>.mdx
    ├── i18n/en.ts    UI strings (English)
    ├── i18n/uk.ts    UI strings (Ukrainian)
    ├── links.json    every external link
    ├── profile.ts    name, headline, bio
    └── photo-meta.ts captions and alt text for mirrored photos
```

Same shape as Vercel's own open repos — `app/`, `components/`, `lib/` grouped by
domain one level deep. Filenames are kebab-case, exports are PascalCase.

The rule: **`content/` is data, `lib/` is logic, `components/` is presentation,
`app/` is routing.** Components take data as props rather than importing it, so
to change what the site says you should only ever need to open `src/content/`.
(`components/layout/` is the one exception — the header and footer read the
profile directly.)

Not on the honour system: those boundaries are ESLint rules in
`eslint.config.mjs`, so crossing one fails `npm run lint`.

---

## Writing a post

Create `src/content/posts/<slug>.<locale>.mdx`. The filename is the URL:
`reading-batch-codes.en.mdx` becomes `/en/blog/reading-batch-codes/`.

```mdx
---
title: 'Reading batch codes without a decoder site'
summary: >-
  One or two sentences. Shown on the index, the home page, and in
  search results.
date: '2026-08-02'
updated: '2026-08-11' # optional
tags: ['batch codes', 'method']
draft: false # optional, defaults to false
fragrance: # optional — renders the specimen card
  house: Chanel
  name: Bleu de Chanel
  perfumer: Jacques Polge
  concentration: EDP # Cologne | EDC | EDT | EDP | Parfum | Extrait | Elixir | Oil
  year: 2014
  batchCode: '4501'
---

Body starts here. Plain Markdown, plus GitHub tables, footnotes, and
fenced code blocks with syntax highlighting.

<Note>An aside for a caveat — sample size, storage history, that kind of thing.</Note>
```

Things worth knowing:

- **Frontmatter is validated at build time.** A bad date, a missing `summary`,
  or a typo like `tag:` instead of `tags:` fails the build with the file name
  and the offending field. It cannot silently ship.
- **Translations are independent.** A post written in only one language is
  listed only in that language. Its URL still exists in the other one and shows
  a pointer to the language that has it, so the language switcher never dead-ends
  mid-article.
- **Tags are per-language** and written in the language of the post. Each one
  gets a pre-rendered page at `/<locale>/blog/tag/<tag>/`; Cyrillic tags are
  transliterated for the URL (`коди партій` → `kody-partii`).
- **`draft: true`** shows the post in `npm run dev` and excludes it from the
  build. Safe to commit.
- **Prettier does not touch `src/content/posts`** — its MDX support predates
  MDX v3 and would corrupt `{/* … */}` comments. Your line breaks are yours.

---

## Common edits

**Change a UI string** → `src/content/i18n/en.ts`, then the matching key in
`uk.ts`. The Ukrainian file is typed against the English one, so a missing or
misspelled key is a compile error rather than an English string leaking into the
Ukrainian site.

**Add a nav item** → one entry in `navItems` in
`src/components/layout/header.tsx`,
one label in each `i18n` file, one folder under `src/app/[locale]/`.

**Change the entire look** → `@theme` block at the top of `src/app/globals.css`.
Colours, radii, and fonts are tokens; the dark palette is the `.dark` block
directly below. Nothing visual is hardcoded in a component.

**Add a language** → add it to `locales` in `src/lib/i18n.ts` and create
`src/content/i18n/<code>.ts`. `generateStaticParams` picks it up automatically.

---

## Deployment

Push to `main` → `deploy.yml` builds and publishes. Nothing else to do.

`ci.yml` runs typecheck, lint, format check, and a full build on every branch and
PR, so `main` cannot receive a broken build.

**Custom domain later:** add a `CNAME` file to `public/`, point DNS at GitHub,
and set `NEXT_PUBLIC_BASE_PATH` to `''` in `deploy.yml`. No code changes.

---

## Status

Phases 0–3 of the plan: skeleton, bilingual routing, theming, CI/CD, the Threads
mirror, and the MDX blog. Pages under `/photos`, `/about`, `/cv`, `/projects` are
still deliberate placeholders. Content arrives in later phases.

Anything marked `TODO(serhii): verify` is invented placeholder text — real
handles, bio, and Ukrainian translations still need your pass.
