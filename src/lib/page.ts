import { replacePageMentions, splitMentions, type Resolve } from './mentions.ts';

// Page model: a tree of elements. Each element has an HTML tag, a natural-language prompt,
// optional literal text, and an auto-layout (flex/grid) describing how its children are arranged.

export type Dir = 'col' | 'row' | 'grid';
export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around';
export type Size = 'auto' | 'hug' | 'fill';

export type Layout = {
	dir: Dir;
	wrap: boolean;
	cols: number;
	gap: number;
	pad: number;
	align: Align;
	justify: Justify;
	w: Size;
	h: Size;
};

export type PageNode = {
	id: string;
	tag: string;
	prompt: string;
	text: string;
	layout: Layout;
	children: PageNode[];
};

export const SPACING = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24];

export const defaultLayout = (): Layout => ({
	dir: 'col',
	wrap: false,
	cols: 2,
	gap: 2,
	pad: 0,
	align: 'stretch',
	justify: 'start',
	w: 'auto',
	h: 'auto'
});

export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeNode(partial: Partial<Omit<PageNode, 'layout' | 'children'>> & { layout?: Partial<Layout>; children?: PageNode[] } = {}): PageNode {
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

function normalize(n: Partial<PageNode>): PageNode {
	return {
		id: n.id || uid(),
		tag: n.tag || 'div',
		prompt: n.prompt ?? '',
		text: n.text ?? '',
		layout: { ...defaultLayout(), ...n.layout },
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
	if (n.children.length) {
		if (l.dir === 'grid') cls.push('grid', `grid-cols-${l.cols}`);
		else cls.push('flex', l.dir === 'row' ? 'flex-row' : 'flex-col');
		if (l.wrap && l.dir !== 'grid') cls.push('flex-wrap');
		if (l.gap) cls.push(`gap-${l.gap}`);
		if (l.align !== 'stretch') cls.push(ALIGN_TW[l.align]);
		if (l.justify !== 'start') cls.push(JUSTIFY_TW[l.justify]);
	}
	if (l.pad) cls.push(`p-${l.pad}`);
	if (l.w === 'fill') cls.push(parentDir === 'row' ? 'flex-1' : 'w-full');
	if (l.w === 'hug') cls.push('w-fit');
	if (l.h === 'fill') cls.push(parentDir === 'col' ? 'flex-1' : 'h-full');
	if (l.h === 'hug') cls.push('h-fit');
	return cls.join(' ');
}

/** Inline CSS equivalent of the tailwind classes, for in-app rendering. */
export function layoutStyle(n: PageNode, scale = 4): string {
	const l = n.layout;
	const s: string[] = [];
	if (l.dir === 'grid') s.push('display:grid', `grid-template-columns:repeat(${l.cols},minmax(0,1fr))`);
	else s.push('display:flex', `flex-direction:${l.dir === 'row' ? 'row' : 'column'}`);
	if (l.wrap && l.dir !== 'grid') s.push('flex-wrap:wrap');
	s.push(`gap:${l.gap * scale}px`);
	if (l.pad) s.push(`padding:${l.pad * scale}px`);
	const ai = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }[l.align];
	const jc = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' }[l.justify];
	s.push(`align-items:${ai}`, `justify-content:${jc}`);
	return s.join(';');
}

export function sizeStyle(n: PageNode, parentDir: Dir | null): string {
	const l = n.layout;
	const s: string[] = ['min-width:0'];
	if (l.w === 'fill') s.push(parentDir === 'row' ? 'flex:1 1 0' : 'width:100%');
	if (l.w === 'hug') s.push('width:fit-content');
	if (l.h === 'fill') s.push(parentDir === 'col' ? 'flex:1 1 0' : 'height:100%');
	if (l.h === 'hug') s.push('height:fit-content');
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
		if (tag === 'img' && r.type !== 'image') continue;
		return ` ${tag === 'a' ? 'href' : 'src'}="${escAttr(r.path)}"`;
	}
	return '';
}

export function nodeToHtml(n: PageNode, parentDir: Dir | null = null, depth = 0, resolve?: Resolve): string {
	const indent = '  '.repeat(depth);
	const tag = safeTag(n.tag);
	const cls = twClasses(n, parentDir);
	// mentions become relative paths in the export (or "@Name" when there is no resolver)
	const sub = (s: string, quote: boolean) =>
		replacePageMentions(s, (id, name) => {
			const p = resolve?.(id)?.path;
			return p ? (quote ? `\`${p}\`` : p) : `@${name}`;
		});
	const prompt = sub(n.prompt, true).trim();
	const text = sub(n.text, false);
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

export function pageToHtml(root: PageNode, title: string, resolve?: Resolve): string {
	const body = { ...root, tag: 'body' };
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <!--
    Layout reference. Classes are Tailwind CSS utilities describing layout only (flex / grid,
    gap, padding, alignment, sizing). HTML comments are natural-language prompts describing the
    element they appear in (or, for void elements like <img> / <input>, the element right after).
    Paths in backticks like \`./hero.png\` or \`../docs/brief.md\` refer to other files in this export.
    Visual styling is intentionally unspecified — follow the prompts.
  -->
</head>
${nodeToHtml(body, null, 0, resolve)}
</html>
`;
}
