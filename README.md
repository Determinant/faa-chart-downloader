# FAR CFR Maker

`build-far.ts` builds FAA FAR outputs from either:
- eCFR (`--source=ecfr`, default)
- annual CFR from GovInfo (`--source=annual`)

It generates the FAR site under `dist/far/`:
- `dist/far/combined.xml` (source XML after volume filtering/merge for the selected source)
- `dist/far/far.xml` (normalized FAR XML)
- `dist/far/index.html` (browsable PWA entry point)

Generated FAR sites also include install metadata, iOS/Android icons, and a
service worker. The split site precaches the shell, part pages, and shared
vendor assets. Serve the output over HTTPS or `localhost` for Add to Home
Screen and offline behavior.
The shell adapts its two-column layout to narrow screens, where the table of
contents becomes a slide-in drawer. Its local search covers section numbers,
subjects, hierarchy, and the full section text embedded in the shell. MiniSearch
is installed from npm and bundled into the generated shell, so the PWA has no
CDN or search-network dependency.

## AIM Mirror

FAA publishes the Aeronautical Information Manual as a multi-page HTML site. The
downloader mirrors the FAA AIM pages and same-site assets into `dist/aim/`,
rewriting same-site links to work locally:

```bash
npm run build:aim
```

The generated mirror also includes install metadata, 192/512px icons, and a
service worker for offline use after pages have been visited. Install behavior
requires serving `dist/aim/` over HTTPS (or `localhost`); opening `index.html`
directly from disk cannot register a service worker. External links such as FAA
publications, search, and Google-hosted fonts remain external; the FAA AIM HTML
pages, stylesheets, scripts, and images are downloaded locally. The command
preserves the previous `dist/aim/` mirror in a hidden sibling directory until
you remove it. Use `node --import=tsx download-aim.ts --help` for options.

## Prerequisites

- Node.js 18+
- npm dependencies
- `xsltproc` on PATH

```bash
npm ci
npm run check
```

## Build the PWA

The default build resolves the current eCFR source and writes the FAR PWA under
`dist/far/`:

```bash
npm run build
```

Build the AIM mirror with:

```bash
npm run build:aim
```

Use npm argument forwarding for a local source or other generator options:

```bash
npm run build -- --source-xml=combined-ecfr.xml --date=2026-04-30
```

The generated search corpus is embedded in `dist/far/index.html` and indexed
locally in the browser with the bundled MiniSearch runtime; no search request
or CDN is needed.

NixOS:

```bash
nix-shell -p libxslt
```

## FAR Output

The FAR build produces `dist/far/index.html` plus one HTML page per included
part under `dist/far/far-parts/`. Upload the complete `dist/far/` directory so
the service worker can precache every regulation page and shared asset.

## Quick Start

Default split mode:

```bash
node --import=tsx build-far.ts --combined=dist/far/combined.xml --far=dist/far/far.xml --html=dist/far/index.html --parts-dir=dist/far/far-parts
```

Annual CFR (GovInfo) by year:

```bash
node --import=tsx build-far.ts \
  --source=annual \
  --year=2025 \
  --combined=dist/far/combined.xml \
  --far=dist/far/far.xml \
  --html=dist/far/index.html \
  --parts-dir=dist/far/far-parts
```

## Local Source XML

If you already downloaded XML:

```bash
node --import=tsx build-far.ts \
  --source-xml=combined-ecfr.xml \
  --date=2026-04-30 \
  --combined=dist/far/combined.xml \
  --far=dist/far/far.xml \
  --html=dist/far/index.html \
  --parts-dir=dist/far/far-parts
```

Annual CFR with local source XML:

```bash
node --import=tsx build-far.ts \
  --source=annual \
  --source-xml=combined-annual.xml \
  --date=2025-01-01 \
  --combined=dist/far/combined.xml \
  --far=dist/far/far.xml \
  --html=dist/far/index.html \
  --parts-dir=dist/far/far-parts
```

## Deploy Checklist

FAR split mode upload: upload the contents of `dist/far/`, including:
- `index.html`
- `far-parts/` (part pages)
- `vendor/` (shared TreeView assets)
- `manifest.webmanifest`, `service-worker.js`, and `icons/`

AIM upload: upload the contents of `dist/aim/`, with `index.html` as its
entry point.

## CLI Options

```text
--source=ecfr|annual
--date=YYYY-MM-DD
--year=YYYY
--vols=1,2,3
--title=14
--chapter=I
--source-xml=chapter.xml
--combined=dist/far/combined-ecfr.xml
--far=dist/far/far-ecfr.xml
--html=dist/far/index.html
--xsl=cfr-ecfr.xsl
--parts-dir=dist/far/far-ecfr-parts
--help / -h
```

Notes:
- `--source=ecfr` is the default mode.
- For `--source=annual` network fetches, `--year` is required unless `--source-xml` is provided.
- If `--date` is omitted in eCFR mode, the latest eCFR date for the title is resolved automatically.
- When eCFR XML is supplied with `--source-xml`, the build stays offline; if no date is provided, the UI identifies the source as eCFR XML with an unspecified snapshot date.
- Hash bookmarks are supported (`#target=...` and legacy `#seqnum...` links).

## Troubleshooting

`xsltproc: command not found`
- Install/provide `xsltproc` (`libxslt` on NixOS).

Right pane shows 404 after deploy
- You likely uploaded only `index.html` in FAR split mode.
- Upload `far-parts/` and `vendor/` too, along with the manifest, service worker, and icons.

`fetch failed` / `EAI_AGAIN` (network/DNS issue)
- Retry later or run with `--source-xml=...` and `--date=...`.

Tree/collapsible UI missing
- Run `npm install` so `js-treeview` assets are available during generation.
