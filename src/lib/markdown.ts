import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { SCHEME } from './mentions.ts';
import { visualSrc } from './drawing.ts';
import type { Item } from './types.ts';

const cache = new Map<string, string>();
const REF_RE = new RegExp(`(!?)\\[([^\\]\\n]*)\\]\\(${SCHEME}([\\w-]+)\\)`, 'g');
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Display URL for an item reference (images → their upload), used by previews and the editor. */
export function mentionSrc(id: string, items: Record<string, Item>) {
	return visualSrc(items[id]);
}

export function renderMarkdown(src: string, items: Record<string, Item> = {}): string {
	// resolve item references first so previews follow renames
	const resolved = src.replace(REF_RE, (_, bang, text, id) => {
		const it = items[id];
		if (bang) return visualSrc(it) ? `![${text}](${visualSrc(it)})` : `*[missing image]*`;
		return `<span class="mention">@${escHtml(it?.name ?? text.replace(/^@/, ''))}</span>`;
	});
	const hit = cache.get(resolved);
	if (hit !== undefined) return hit;
	const html = typeof window === 'undefined' ? '' : DOMPurify.sanitize(marked.parse(resolved, { async: false }) as string);
	if (cache.size > 300) cache.clear();
	cache.set(resolved, html);
	return html;
}
