import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listItems, UPLOAD_DIR } from './db.ts';
import { pageToHtml, parsePage } from '#lib/page.ts';
import { exportMarkdown, planExport, resolverFor } from '#lib/mentions.ts';
import { drawingPng } from '#lib/drawing.ts';
import { notebookToPy, parseNotebook } from '#lib/notebook.ts';
import type { Project } from '#lib/types.ts';

export type ExportEntry = { path: string; data?: Buffer | string; dir?: boolean };

export const cleanName = (s: string) => s.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/^\.+/, '').trim() || 'untitled';

/**
 * Every file of a project, at its path inside the export: canvases become folders,
 * markdown → .md, pages → .html fragments, notebooks → .py, drawings → .png, images as uploaded.
 */
export function exportEntries(project: Project): ExportEntry[] {
	const items = listItems(project.id);
	const plan = planExport(items, project.root_id);
	const upload = (file: string) => {
		const path = join(UPLOAD_DIR, file);
		return existsSync(path) ? readFileSync(path) : null;
	};
	const out: ExportEntry[] = [];
	const add = (path: string, data: Buffer | string | null) => data !== null && out.push({ path, data });

	for (const it of items) {
		const path = plan.paths.get(it.id);
		if (path === undefined || it.id === project.root_id) continue;
		if (it.type === 'canvas') out.push({ path, dir: true });
		else if (it.type === 'markdown') {
			add(path, exportMarkdown(it.content, it.id, plan));
			for (const [file, assetPath] of plan.assets.get(it.id) ?? []) add(assetPath, upload(file));
		} else if (it.type === 'page') add(path, pageToHtml(parsePage(it.content), resolverFor(plan, it.id)));
		else if (it.type === 'notebook') add(path, notebookToPy(parseNotebook(it.content)));
		else if (it.type === 'drawing') {
			// rendered to PNG by the editor whenever the drawing changes
			const png = drawingPng(it.content);
			add(path, png && upload(png));
		} else if (it.type === 'image') add(path, upload(it.content));
	}
	// stable order keeps archives reproducible
	return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Instructions for coding agents on how to treat the exported `.spatial/` folder. */
export function agentsMd() {
	return `
## Spatial spec (\`.spatial/\`)

\`.spatial/\` is the product spec for this repository, exported from Spatial (an infinite canvas
where the team designs pages, writes requirements and sketches ideas). It is the source of truth
for *what* to build; the existing code decides *how*. Never edit files in \`.spatial/\` — the
folder is replaced on every export. If the spec looks wrong or contradicts itself, say so.

### What the files mean

- **Folders** are canvases: they group related material.
- **\`*.md\`** — requirements, briefs and notes. Images they embed sit next to them.
- **\`*.html\`** — layout references for pages and components. They are fragments, not complete documents:
  - The tag tree is the structure to build.
  - \`class\` holds Tailwind utilities that describe **layout only** (flex/grid, gap, padding,
    alignment, sizing). Visual style is intentionally unspecified: follow the prompts and the
    project's existing design system. You don't have to use Tailwind.
  - HTML comments are natural-language prompts describing the element they are in (for void
    elements such as \`<img>\` or \`<input>\`: the element right after the comment). A comment at the
    top of a file describes the whole page or component.
  - Text content is literal copy.
  - Paths in backticks (\`\` \`./Header.html\` \`\`, \`\` \`../brief.md\` \`\`) and \`src\`/\`href\`
    attributes point to other files in \`.spatial/\`.
  - **Components:** an element whose prompt references another \`.html\` file *is* that
    component. Build the referenced file once as a reusable component and use it everywhere it
    is referenced.
- **\`*.py\`** — Python notebooks (percent format, \`# %%\` cells) that demonstrate behaviour:
  algorithms, data shapes, calculations, charts. They express intent; port the logic to the
  project's own stack rather than shipping them, unless asked otherwise.
- **\`*.png\`, \`*.jpg\`, …** — mockups, drawings and reference images.

### "Build", "implement", "update"

When asked to build, implement or update the app (from the spec), implement what changed in
\`.spatial/\` since it was last implemented:

1. Read the hash of the last implemented spec from \`.spatial-implemented\` at the repository root.
   - If it exists, the change is \`git diff <hash> -- .spatial\` (this includes uncommitted spec
     changes); \`git log <hash>..HEAD -- .spatial\` shows the commit messages.
   - If it does not exist, the whole spec is new: compare it with the current code and implement
     whatever is missing.
2. Read every changed file in full, plus the files it references, for context.
3. Apply the change to the code: added → build it, modified → update it, deleted → remove the
   feature. A deleted file plus an added file with similar content is a rename or move.
   Unchanged spec files are already implemented — leave that code alone unless a changed file
   requires otherwise.
4. Ask before guessing when the spec is ambiguous.
5. When done, write the commit hash of the implemented spec
   (\`git log -1 --format=%H -- .spatial\`) to \`.spatial-implemented\` and commit it together with
   the implementation. Summarize which spec changes you implemented.
`.trimStart();
}
