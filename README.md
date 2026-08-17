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
├── app/                  routing only — no content, no business logic
│   ├── page.tsx          `/` locale detector
│   ├── not-found.tsx     404
│   └── [locale]/         every real page, generated for `en` and `uk`
├── components/
│   ├── layout/           Header, Footer, ThemeToggle, LocaleSwitcher
│   └── ui/               Card, BentoGrid, Chip — dumb primitives
├── content/              ← EDIT THIS. Everything you maintain by hand.
│   ├── i18n/en.ts        UI strings (English)
│   ├── i18n/uk.ts        UI strings (Ukrainian)
│   ├── profile.ts        name, headline, bio
│   └── social.ts         every external link
└── lib/                  types, i18n helpers, path helpers
```

The rule: **`content/` is data, `components/` is presentation, `app/` is routing.**
Components never import from `content/` — pages pass data down. To change what
the site says, you should only ever need to open `src/content/`.

---

## Common edits

**Change a UI string** → `src/content/i18n/en.ts`, then the matching key in
`uk.ts`. The Ukrainian file is typed against the English one, so a missing or
misspelled key is a compile error rather than an English string leaking into the
Ukrainian site.

**Add a nav item** → one entry in `navItems` in `src/components/layout/Header.tsx`,
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

Phases 0–2 of the plan: skeleton, bilingual routing, theming, CI/CD.
Pages under `/blog`, `/photos`, `/about`, `/cv`, `/projects` are deliberate
placeholders. Content arrives in later phases.

Anything marked `TODO(serhii): verify` is invented placeholder text — real
handles, bio, and Ukrainian translations still need your pass.
