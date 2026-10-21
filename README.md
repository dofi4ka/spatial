# Spatial

A collaborative editor for writing complicated prompts on an infinite canvas.

- **Infinite canvas** (pan, zoom, marquee select, drag, resize) where you place **files** and nested **canvases** (folders). Every card shows a live preview; canvases show a mini-map of what's inside.
- **Markdown** files: WYSIWYG editor (Milkdown), stored as plain `.md`.
- **Images**: drop, paste or upload onto the canvas.
- **Drawings**: open in Excalidraw. Each edit also renders the drawing to PNG, which is used for the canvas preview, mentions and the export.
- **Pages**: a prompt-first site builder. Every element has an HTML tag, a natural-language **prompt**, optional literal **text**, and an **auto layout** (column / row / grid, gap, padding, align, justify, hug/fill sizing). There are no styling options on purpose. A library of ~180 components (grouped, searchable) can be dragged onto the page.
- **Python notebooks**: code and text cells that run **in the browser** with [Pyodide](https://pyodide.org) (in a Web Worker; nothing runs on the server). Imports such as `numpy`, `pandas` and `matplotlib` load on demand. Figures render automatically, the last expression is shown, and `display()`, `HTML(...)` and `SVG(...)` render rich output (HTML runs in a sandboxed frame). The last outputs are saved with the notebook. Use them to show an algorithm, a data shape or a chart instead of describing it.
- **Components**: right-click an element in the page editor → *Move to separate page*. The element becomes its own page next to the current one and is replaced by a `<div>` whose prompt mentions it; the editor shows a preview of the mentioned page. The element clipboard is shared between pages (and tabs), so you can copy in one page and paste in another.
- **Mentions**: type `@` in a markdown doc or in a page element's prompt/text to reference another file (image, page, markdown, canvas). Mentions follow renames and moves; ⌘-click one in markdown to open it. Mentioning an image in markdown embeds it; in a page, an `<img>`/`<a>` gets its `src`/`href` from the first mention.
- **Export** (the *Export* page of a project): copy-paste shell commands that put the project in your repository as `.spatial/` and commit it, plus a one-time command that appends instructions for coding agents to `AGENTS.md` (how to read the files, and how to implement just what changed since the last implemented spec). The commands use a secret per-project link (`/export/<token>/…`) that works without signing in; *New link* revokes it. A `.zip` download is still there. Canvases become folders, markdown → `.md`, images → image files, drawings → `.png`, notebooks → percent-format `.py`, pages → `.html` fragments (no document boilerplate) with layout as Tailwind classes and prompts as HTML comments. Every mention becomes the relative path to the mentioned file (e.g. `../Home.html`, `` `./Hero shot.png` `` in prompts). Images uploaded straight into a markdown doc are exported next to it as `<doc>.image-N.<ext>`.
- **Live collaboration**: changes, presence and cursors sync through Server-Sent Events. Edits to the same file are last-writer-wins; an open editor picks up remote changes when you pause typing.
- **Users & projects** (GitHub-style): anyone can create an account at `/signup` (no email confirmation); the admin is configured via env and can also create accounts at `/admin`. Every project has an owner, a description and a visibility: **private** (only the owner and members) or **public** (every signed-in user can view it read-only). The owner adds people by email in the project's settings; members can view and edit everything (and leave), only the owner changes visibility, manages people or deletes the project. Admins see every project at `/admin/projects` (read-only unless they are a member) and can delete them; deleting a user hands their projects to the admin who deleted them. Projects from before ownership existed are assigned to their creator, with every other user added as a member.

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

Canvas: `C` / `M` / `P` / `D` / `N` / `I` new canvas / markdown / page / drawing / notebook / image · double-click to open · `Enter` open · `F2` rename · `⌘D` duplicate · `⌫` delete · `Space`+drag or scroll to pan · `⌘`/pinch+scroll to zoom · `Shift+1` fit. Drag cards onto a canvas card or a breadcrumb to move them there.

Page editor: right-click an element for all actions and their shortcuts. `D` / `T` add a div / text after the selection (`⇧D` / `⇧T` inside it) · drag components from the left · `⌫` delete · `⌘D` duplicate · `⌘G` wrap in container (`⇧⌘G` unwrap) · `⌘C` / `⌘X` / `⌘V` copy / cut / paste after (`⇧⌘V` paste inside) · `Alt+↑/↓` reorder · `Esc` select parent · `Enter` / double-click edit prompt · `⌘Z` / `⇧⌘Z` undo/redo.

Notebook: `⇧↵` run cell and move to the next · `⌘↵` run cell · *Stop* / *Restart* kills the Python worker (variables are cleared).

## Layout

- `src/lib/server` – SQLite, auth, project access (`projectAccess` in `db.ts`, enforced by `ctx` in `api.ts`), SSE hub
- `src/lib/store.svelte.ts` – client project store (optimistic updates + live sync)
- `src/lib/components/canvas` – infinite canvas and previews
- `src/lib/components/page` + `src/lib/page.ts` – page model, editor, HTML export
- `src/lib/components-library.ts` – the component library
- `src/lib/notebook.ts`, `src/lib/python.worker.ts` – notebook model and the in-browser Python kernel
- `src/lib/server/export.ts`, `src/lib/server/tar.ts` – export (zip / tar.gz) and the `AGENTS.md` text
