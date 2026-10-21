import { replacePageMentions, splitMentions, type Resolve } from './mentions.ts';
import { isVisual } from './drawing.ts';

// Page model: a tree of elements. Each element has an HTML tag, a natural-language prompt,
// optional literal text, and a Figma-style auto layout describing how its children are arranged.
// Spacing values are in px.

/** none = no auto layout (children simply stack as blocks) */
export type Dir = 'none' | 'col' | 'row' | 'grid';
export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around';
/** auto = CSS default, hug = fit content, fill = take remaining space, fixed = wv/hv px */
export type Size = 'auto' | 'hug' | 'fill' | 'fixed';

export type Layout = {
	v: 2;
	dir: Dir;
	wrap: boolean;
	cols: number;
	gap: number;
	/** padding top / right / bottom / left */
	pt: number;
	pr: number;
	pb: number;
	pl: number;
	/** cross-axis alignment of children */
	align: Align;
	/** main-axis distribution; "between" is Figma's "Auto" gap */
	justify: Justify;
	w: Size;
	h: Size;
	wv: number;
	hv: number;
	clip: boolean;
};

export type PageNode = {
	id: string;
	tag: string;
	prompt: string;
	text: string;
	layout: Layout;
	children: PageNode[];
};

export const defaultLayout = (): Layout => ({
	v: 2,
	dir: 'col',
	wrap: false,
	cols: 2,
	gap: 8,
	pt: 0,
	pr: 0,
	pb: 0,
	pl: 0,
	align: 'stretch',
	justify: 'start',
	w: 'auto',
	h: 'auto',
	wv: 320,
	hv: 200,
	clip: false
});

/** Older layouts (and the component library) use Tailwind spacing units and a single `pad`. */
export type LegacyLayout = Partial<Omit<Layout, 'v'>> & { pad?: number; v?: number };

export function upgradeLayout(l: LegacyLayout | undefined): Layout {
	const base = defaultLayout();
	if (!l) return base;
	if (l.v === 2) return { ...base, ...(l as Layout) };
	const { pad = 0, gap, v: _v, ...rest } = l;
	return { ...base, ...rest, gap: gap === undefined ? base.gap : gap * 4, pt: pad * 4, pr: pad * 4, pb: pad * 4, pl: pad * 4, v: 2 };
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeNode(
	partial: Partial<Omit<PageNode, 'layout' | 'children'>> & { layout?: Partial<Layout>; children?: PageNode[] } = {}
): PageNode {
	return {
		id: uid(),
		tag: partial.tag ?? 'div',
		prompt: partial.prompt ?? '',
		text: partial.text ?? '',
		layout: { ...defaultLayout(), ...partial.layout },
		children: partial.children ?? []
	};
}

export function emptyPage(): PageNode {
	return makeNode({ tag: 'body', prompt: '', layout: { gap: 0 } });
}

export function parsePage(content: string): PageNode {
	try {
		const n = JSON.parse(content);
		if (n && typeof n === 'object' && Array.isArray(n.children)) return normalize(n);
	} catch {
		/* fallthrough */
	}
	return emptyPage();
}

function normalize(n: Partial<Omit<PageNode, 'layout'>> & { layout?: LegacyLayout }): PageNode {
	return {
		id: n.id || uid(),
		tag: n.tag || 'div',
		prompt: n.prompt ?? '',
		text: n.text ?? '',
		layout: upgradeLayout(n.layout),
		children: (n.children ?? []).map(normalize)
	};
}

export function cloneWithNewIds(n: PageNode): PageNode {
	return { ...n, id: uid(), layout: { ...n.layout }, children: n.children.map(cloneWithNewIds) };
}

export function findNode(root: PageNode, id: string): PageNode | null {
	if (root.id === id) return root;
	for (const c of root.children) {
		const f = findNode(c, id);
		if (f) return f;
	}
	return null;
}

export function findParent(root: PageNode, id: string): PageNode | null {
	for (const c of root.children) {
		if (c.id === id) return root;
		const f = findParent(c, id);
		if (f) return f;
	}
	return null;
}

export function contains(n: PageNode, id: string): boolean {
	return n.id === id || n.children.some((c) => contains(c, id));
}

export function countNodes(n: PageNode): number {
	return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
}

// ---------- rendering helpers ----------

export const VOID_TAGS = new Set(['img', 'input', 'hr', 'br', 'meta', 'link', 'source', 'area', 'col', 'embed', 'track', 'wbr']);

const ALIGN_TW: Record<Align, string> = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' };
const JUSTIFY_TW: Record<Justify, string> = {
	start: 'justify-start',
	center: 'justify-center',
	end: 'justify-end',
	between: 'justify-between',
	around: 'justify-around'
};

/** Tailwind classes for a node; parentDir decides how "fill" is expressed. */
export function twClasses(n: PageNode, parentDir: Dir | null): string {
	const l = n.layout;
	const cls: string[] = [];
	if (n.children.length && l.dir !== 'none') {
		if (l.dir === 'grid') cls.push('grid', `grid-cols-${l.cols}`);
		else cls.push('flex', l.dir === 'row' ? 'flex-row' : 'flex-col');
		if (l.wrap && l.dir !== 'grid') cls.push('flex-wrap');
		if (l.gap && l.justify !== 'between') cls.push(tw('gap', l.gap));
		if (l.align !== 'stretch') cls.push(ALIGN_TW[l.align]);
		if (l.justify !== 'start') cls.push(JUSTIFY_TW[l.justify]);
	}
	cls.push(...paddingClasses(l));
	cls.push(...sizeClasses('w', l.w, l.wv, parentDir === 'row'));
	cls.push(...sizeClasses('h', l.h, l.hv, parentDir === 'col'));
	if (l.clip) cls.push('overflow-hidden');
	return cls.join(' ');
}

/** Tailwind spacing token for a px value: 16 → "p-4", 10 → "p-2.5", 13 → "p-[13px]". */
function tw(prefix: string, px: number) {
	const u = px / 4;
	return Number.isInteger(u) || Number.isInteger(u * 2) ? `${prefix}-${u}` : `${prefix}-[${px}px]`;
}

function paddingClasses(l: Layout): string[] {
	const { pt, pr, pb, pl } = l;
	if (pt === pr && pr === pb && pb === pl) return pt ? [tw('p', pt)] : [];
	if (pt === pb && pl === pr) return [pl && tw('px', pl), pt && tw('py', pt)].filter(Boolean) as string[];
	return [pt && tw('pt', pt), pr && tw('pr', pr), pb && tw('pb', pb), pl && tw('pl', pl)].filter(Boolean) as string[];
}

function sizeClasses(axis: 'w' | 'h', s: Size, v: number, mainAxis: boolean): string[] {
	if (s === 'fill') return [mainAxis ? 'flex-1' : `${axis}-full`];
	if (s === 'hug') return [`${axis}-fit`];
	if (s === 'fixed') return [`${axis}-[${v}px]`, ...(mainAxis ? ['shrink-0'] : [])];
	return [];
}

const pad = (l: Layout) => `${l.pt}px ${l.pr}px ${l.pb}px ${l.pl}px`;

/** Inline CSS for the children container in the editor (mirrors the Tailwind classes). */
export function layoutStyle(n: PageNode): string {
	const l = n.layout;
	const s: string[] = [`padding:${pad(l)}`];
	if (l.clip) s.push('overflow:hidden');
	if (l.dir === 'none') return [...s, 'display:flex', 'flex-direction:column', 'gap:0'].join(';');
	if (l.dir === 'grid') s.push('display:grid', `grid-template-columns:repeat(${l.cols},minmax(0,1fr))`);
	else s.push('display:flex', `flex-direction:${l.dir === 'row' ? 'row' : 'column'}`);
	if (l.wrap && l.dir !== 'grid') s.push('flex-wrap:wrap');
	s.push(`gap:${l.justify === 'between' ? 0 : l.gap}px`);
	const ai = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }[l.align];
	const jc = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' }[l.justify];
	s.push(`align-items:${ai}`, `justify-content:${jc}`);
	return s.join(';');
}

export function sizeStyle(n: PageNode, parentDir: Dir | null): string {
	const l = n.layout;
	const s: string[] = ['min-width:0'];
	const size = (axis: 'width' | 'height', v: Size, px: number, main: boolean) => {
		if (v === 'fill') s.push(main ? 'flex:1 1 0' : `${axis}:100%`);
		if (v === 'hug') s.push(`${axis}:fit-content`);
		if (v === 'fixed') s.push(`${axis}:${px}px`, ...(main ? ['flex-shrink:0'] : []));
	};
	size('width', l.w, l.wv, parentDir === 'row');
	size('height', l.h, l.hv, parentDir === 'col');
	return s.join(';');
}

// ---------- HTML export ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');
const safeComment = (s: string) => s.replace(/--/g, '- -').replace(/-$/, '- ');
const safeTag = (t: string) => (/^[a-zA-Z][\w-]*$/.test(t) ? t.toLowerCase() : 'div');

function comment(prompt: string, indent: string) {
	const p = safeComment(prompt.trim());
	if (!p.includes('\n')) return `${indent}<!-- ${p} -->`;
	return `${indent}<!--\n${p
		.split('\n')
		.map((l) => `${indent}  ${l}`)
		.join('\n')}\n${indent}-->`;
}

function textAttr(tag: string, text: string) {
	if (!text) return '';
	if (tag === 'img') return ` alt="${escAttr(text)}"`;
	if (tag === 'input') return ` placeholder="${escAttr(text)}"`;
	return '';
}

/** Attribute pointing at the first mentioned file that fits the tag (img → image, a → any file). */
function linkAttr(tag: string, raw: string, resolve?: Resolve) {
	if (!resolve || (tag !== 'img' && tag !== 'a' && tag !== 'video' && tag !== 'iframe')) return '';
	for (const seg of splitMentions(raw)) {
		if (seg.t !== 'mention') continue;
		const r = resolve(seg.id);
		if (!r) continue;
		if (tag === 'img' && !isVisual(r.type)) continue;
		return ` ${tag === 'a' ? 'href' : 'src'}="${escAttr(r.path)}"`;
	}
	return '';
}

/** Mentions become relative paths in the export (or "@Name" when there is no resolver). */
function subMentions(s: string, quote: boolean, resolve?: Resolve) {
	return replacePageMentions(s, (id, name) => {
		const p = resolve?.(id)?.path;
		return p ? (quote ? `\`${p}\`` : p) : `@${name}`;
	});
}

export function nodeToHtml(n: PageNode, parentDir: Dir | null = null, depth = 0, resolve?: Resolve): string {
	const indent = '  '.repeat(depth);
	const tag = safeTag(n.tag);
	const cls = twClasses(n, parentDir);
	const prompt = subMentions(n.prompt, true, resolve).trim();
	const text = subMentions(n.text, false, resolve);
	const attrs = (cls ? ` class="${cls}"` : '') + linkAttr(tag, n.text + '\n' + n.prompt, resolve) + textAttr(tag, text);

	if (VOID_TAGS.has(tag)) {
		return (prompt ? comment(prompt, indent) + '\n' : '') + `${indent}<${tag}${attrs} />`;
	}

	const inner: string[] = [];
	if (prompt) inner.push(comment(prompt, indent + '  '));
	if (text.trim()) inner.push(
		text
			.trim()
			.split('\n')
			.map((l) => `${indent}  ${esc(l)}`)
			.join(`<br />\n`)
	);
	for (const c of n.children) inner.push(nodeToHtml(c, n.layout.dir, depth + 1, resolve));

	if (!inner.length) return `${indent}<${tag}${attrs}></${tag}>`;
	// Keep tiny leaf elements on one line: <button class="..."><!-- primary -->Save</button>
	if (!n.children.length && !prompt.includes('\n') && !text.includes('\n') && (prompt.length + text.length) < 80) {
		const c = prompt ? `<!-- ${safeComment(prompt)} -->` : '';
		return `${indent}<${tag}${attrs}>${c}${esc(text.trim())}</${tag}>`;
	}
	return `${indent}<${tag}${attrs}>\n${inner.join('\n')}\n${indent}</${tag}>`;
}

/**
 * A page as a plain HTML fragment: the page prompt as a leading comment, then its elements.
 * No document boilerplate, so a page doubles as a reusable snippet that other pages mention.
 * The page's own layout only becomes a wrapper <div> when it differs from plain stacking.
 */
export function pageToHtml(root: PageNode, resolve?: Resolve): string {
	const out: string[] = [];
	const prompt = subMentions(root.prompt, true, resolve).trim();
	if (prompt) out.push(comment(prompt, ''));
	const cls = twClasses(root, null);
	if (!cls || cls === 'flex flex-col') for (const c of root.children) out.push(nodeToHtml(c, root.layout.dir, 0, resolve));
	else out.push(nodeToHtml({ ...root, tag: 'div', prompt: '' }, null, 0, resolve));
	return out.join('\n') + '\n';
}
