// Mentions reference other items in the project by id, so they survive renames and moves.
//
//  - Page prompts / text:   @[Hero image](#spatial:abc123)
//  - Markdown:              [@Pricing page](#spatial:abc123)  or  ![Hero](#spatial:abc123)  for images
//
// On export every mention is replaced by the relative path from the exporting file to the
// mentioned file inside the zip. Images uploaded straight into a markdown document
// (/uploads/xyz.png) are exported next to the .md as "<doc>.image-N.png".
import type { Item, ItemType } from './types.ts';
import { drawingPng } from './drawing.ts';

// A fragment-style marker: editors and sanitizers treat it as a harmless relative link.
export const SCHEME = '#spatial:';
const ID = '[\\w-]+';

/** Page token: @[Name](#spatial:id) */
const PAGE_RE = new RegExp(`@\\[([^\\]\\n]*)\\]\\(${SCHEME}(${ID})\\)`, 'g');
/** Markdown link or image whose target is an item: [text](#spatial:id) / ![alt](#spatial:id) */
const MD_REF_RE = new RegExp(`(!?)\\[([^\\]\\n]*)\\]\\(${SCHEME}(${ID})\\)`, 'g');
/** Images uploaded directly into a markdown doc */
const UPLOAD_RE = /\/uploads\/([\w-]+\.(?:png|jpg|gif|webp|svg|avif))/g;

const cleanName = (s: string) => s.replace(/[[\]\n]/g, '').trim();

export const mentionToken = (name: string, id: string) => `@[${cleanName(name)}](${SCHEME}${id})`;
export const markdownMention = (name: string, id: string, image: boolean) =>
	image ? `![${cleanName(name)}](${SCHEME}${id})` : `[@${cleanName(name)}](${SCHEME}${id})`;

export type Segment = { t: 'text'; v: string } | { t: 'mention'; id: string; name: string };

/** Splits page text into plain text and mention segments (for rendering chips). */
export function splitMentions(s: string): Segment[] {
	const out: Segment[] = [];
	let last = 0;
	for (const m of s.matchAll(PAGE_RE)) {
		if (m.index! > last) out.push({ t: 'text', v: s.slice(last, m.index) });
		out.push({ t: 'mention', name: m[1], id: m[2] });
		last = m.index! + m[0].length;
	}
	if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
	return out;
}

export function replacePageMentions(s: string, fn: (id: string, name: string) => string) {
	return s.replace(PAGE_RE, (_, name, id) => fn(id, name));
}

/** Ids mentioned anywhere in a string (page tokens or markdown refs). */
export function mentionedIds(s: string): string[] {
	return [...new Set([...s.matchAll(MD_REF_RE)].map((m) => m[3]))];
}

// ---------- export planning (shared by server export and in-app HTML preview) ----------

export type ExportPlan = {
	/** item id → path inside the project folder ('' for the root canvas) */
	paths: Map<string, string>;
	types: Map<string, ItemType>;
	/** markdown item id → (uploaded filename → exported asset path) */
	assets: Map<string, Map<string, string>>;
};

const clean = (s: string) => s.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/^\.+/, '').trim() || 'untitled';

export function planExport(items: Item[], rootId: string): ExportPlan {
	const children = new Map<string, Item[]>();
	for (const it of items) if (it.parent_id) (children.get(it.parent_id) ?? children.set(it.parent_id, []).get(it.parent_id)!).push(it);
	const plan: ExportPlan = { paths: new Map([[rootId, '']]), types: new Map(items.map((i) => [i.id, i.type])), assets: new Map() };

	const walk = (canvasId: string, dir: string) => {
		const used = new Set<string>();
		const unique = (base: string, ext: string) => {
			let name = `${base}${ext}`;
			for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})${ext}`;
			used.add(name.toLowerCase());
			return dir ? `${dir}/${name}` : name;
		};
		// reading order on the canvas: top-to-bottom, left-to-right
		const kids = [...(children.get(canvasId) ?? [])].sort((a, b) => a.y - b.y || a.x - b.x);
		const later: (() => void)[] = [];
		for (const it of kids) {
			// hidden from export: left out entirely (a hidden canvas takes its subtree with it)
			if (it.hidden) continue;
			const base = clean(it.name);
			if (it.type === 'canvas') {
				const p = unique(base, '');
				plan.paths.set(it.id, p);
				later.push(() => walk(it.id, p));
			} else if (it.type === 'markdown') {
				const name = base.replace(/\.md$/i, '');
				plan.paths.set(it.id, unique(name, '.md'));
				const uploads = [...new Set([...it.content.matchAll(UPLOAD_RE)].map((m) => m[1]))];
				if (uploads.length) {
					later.unshift(() => {
						const map = new Map<string, string>();
						uploads.forEach((file, i) => map.set(file, unique(`${name}.image-${i + 1}`, '.' + file.split('.').pop())));
						plan.assets.set(it.id, map);
					});
				}
			} else if (it.type === 'page') plan.paths.set(it.id, unique(base.replace(/\.html?$/i, ''), '.html'));
			else if (it.type === 'notebook') plan.paths.set(it.id, unique(base.replace(/\.(py|ipynb)$/i, ''), '.py'));
			else if (it.type === 'drawing') {
				if (drawingPng(it.content)) plan.paths.set(it.id, unique(base.replace(/\.(png|excalidraw)$/i, ''), '.png'));
			} else if (it.type === 'image' && it.content)
				plan.paths.set(it.id, unique(base.replace(/\.(png|jpe?g|gif|webp|svg|avif)$/i, ''), '.' + it.content.split('.').pop()));
		}
		for (const f of later) f();
	};
	walk(rootId, '');
	return plan;
}

/** Relative path from one exported file to another, e.g. "../images/hero.png". */
export function relPath(fromFile: string, to: string) {
	const from = fromFile.split('/').slice(0, -1);
	const target = to.split('/').filter(Boolean);
	let i = 0;
	while (i < from.length && i < target.length - 1 && from[i] === target[i]) i++;
	const rel = [...Array(from.length - i).fill('..'), ...target.slice(i)].join('/');
	if (!rel) return './';
	return rel.startsWith('..') ? rel : `./${rel}`;
}

export type Resolve = (id: string) => { path: string; type: ItemType } | null;

/** Resolver giving paths relative to `fromId`'s exported file. */
export function resolverFor(plan: ExportPlan, fromId: string): Resolve {
	const from = plan.paths.get(fromId) ?? '';
	return (id) => {
		const p = plan.paths.get(id);
		const type = plan.types.get(id);
		if (p === undefined || !type) return null;
		const rel = relPath(from, p);
		return { path: type === 'canvas' && !rel.endsWith('/') ? `${rel}/` : rel, type };
	};
}

/** Rewrites a markdown document for export: item refs and uploaded images → relative paths. */
export function exportMarkdown(md: string, id: string, plan: ExportPlan) {
	const resolve = resolverFor(plan, id);
	const from = plan.paths.get(id) ?? '';
	const assets = plan.assets.get(id);
	return md
		.replace(MD_REF_RE, (all, bang, text, ref) => {
			const r = resolve(ref);
			if (!r) return bang ? `![${text}](missing)` : text;
			// the image block stores its size ratio in the alt text; use the file name instead
			const alt = bang && /^\d+(\.\d+)?$/.test(text) ? r.path.split('/').pop()!.replace(/\.[^.]+$/, '') : text;
			return `${bang}[${alt}](${encodeURI(r.path)})`;
		})
		.replace(UPLOAD_RE, (all, file) => (assets?.has(file) ? encodeURI(relPath(from, assets.get(file)!)) : all));
}
