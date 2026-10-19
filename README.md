# Spatial

A collaborative editor for writing complicated prompts on an infinite canvas.

- **Infinite canvas** (pan, zoom, marquee select, drag, resize) where you place **files** and nested **canvases** (folders). Every card shows a live preview; canvases show a mini-map of what's inside.
- **Markdown** files: WYSIWYG editor (Milkdown), stored as plain `.md`.
- **Images**: drop, paste or upload onto the canvas.
- **Pages**: a prompt-first site builder. Every element has an HTML tag, a natural-language **prompt**, optional literal **text**, and an **auto layout** (column / row / grid, gap, padding, align, justify, hug/fill sizing). There are no styling options on purpose. A library of 200+ components (grouped, searchable) can be dragged onto the page.
- **Mentions**: type `@` in a markdown doc or in a page element's prompt/text to reference another file (image, page, markdown, canvas). Mentions follow renames and moves; ⌘-click one in markdown to open it. Mentioning an image in markdown embeds it; in a page, an `<img>`/`<a>` gets its `src`/`href` from the first mention.
- **Export .zip**: canvases become folders, markdown → `.md`, images → image files, pages → `.html` with layout as Tailwind classes and prompts as HTML comments. Every mention becomes the relative path to the mentioned file (e.g. `../Home.html`, `` `./Hero shot.png` `` in prompts). Images uploaded straight into a markdown doc are exported next to it as `<doc>.image-N.<ext>`.
- **Live collaboration**: changes, presence and cursors sync through Server-Sent Events. Edits to the same file are last-writer-wins; an open editor picks up remote changes when you pause typing.
- **Users**: no sign-up. The admin is configured via env and creates other accounts at `/admin`. Every user sees every project.

## Run

Requires Node 22.5+ (uses the built-in `node:sqlite`).

```bash
cp .env.example .env   # set ADMIN_EMAIL / ADMIN_PASSWORD
pnpm install
pnpm dev
```

Production:

```bash
pnpm build
node build             # PORT=3000 by default; reads .env from the working directory
```

### Docker

Images are published to `ghcr.io/dofi4ka/spatial` (`latest` from `main`, plus `vX.Y.Z` tags) by `.github/workflows/docker.yml` for amd64 and arm64.

```bash
cp .env.example .env   # set ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up -d --build   # local build, http://localhost:3000
```

Data (SQLite + images) lives in the `/data` volume. Set `ORIGIN` to the public URL (e.g. `https://spatial.example.com`) unless a reverse proxy sends `X-Forwarded-Proto` / `X-Forwarded-Host`.

| Env var          | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| `ADMIN_EMAIL`    | Admin login. Created (or re-synced) on every server start |
| `ADMIN_PASSWORD` | Admin password                                            |
| `DATA_DIR`       | SQLite DB + uploaded images (default `./data`)            |
| `ORIGIN`         | Public URL in production (Docker), e.g. `https://…`       |

## Keyboard

Canvas: `C` / `M` / `P` / `I` new canvas / markdown / page / image · double-click to open · `Enter` open · `F2` rename · `⌘D` duplicate · `⌫` delete · `Space`+drag or scroll to pan · `⌘`/pinch+scroll to zoom · `Shift+1` fit. Drag cards onto a canvas card or a breadcrumb to move them there.

Page editor: drag components from the left · `⌫` delete · `⌘D` duplicate · `⌘G` wrap in container (`⇧⌘G` unwrap) · `⌘C`/`⌘V` copy/paste · `Alt+↑/↓` reorder · `Esc` select parent · `Enter` / double-click edit prompt · `⌘Z` / `⇧⌘Z` undo/redo.

## Layout

- `src/lib/server` – SQLite, auth, SSE hub
- `src/lib/store.svelte.ts` – client project store (optimistic updates + live sync)
- `src/lib/components/canvas` – infinite canvas and previews
- `src/lib/components/page` + `src/lib/page.ts` – page model, editor, HTML export
- `src/lib/components-library.ts` – the component library
