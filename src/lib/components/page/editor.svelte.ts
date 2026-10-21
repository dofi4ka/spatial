import { cloneWithNewIds, contains, findNode, findParent, makeNode, parsePage, VOID_TAGS, type PageNode } from '#lib/page.ts';
import { defToNode, LIBRARY } from '#lib/components-library.ts';

export type Drop = { parentId: string; index: number };
export type DragPayload = { kind: 'comp'; g: number; i: number } | { kind: 'node'; id: string };

export const DND_TYPE = 'application/x-spatial';

// The element clipboard is shared by every page editor (and browser tab), so a copied element
// survives closing the page and can be pasted into another one.
const CLIP_KEY = 'spatial:page-clipboard';
let memoryClip: string | null = null;

function writeClipboard(n: PageNode) {
	memoryClip = JSON.stringify(n);
	try {
		localStorage.setItem(CLIP_KEY, memoryClip);
	} catch {
		/* storage unavailable: keep it in memory */
	}
}

export function readClipboard(): PageNode | null {
	let raw = memoryClip;
	try {
		raw = localStorage.getItem(CLIP_KEY) ?? raw;
	} catch {
		/* ignore */
	}
	if (!raw) return null;
	const n = parsePage(raw);
	return n.tag === 'body' && !n.children.length ? null : n;
}

export type MenuState = { x: number; y: number; id: string };

/** Editing state for one page: tree, selection, history, drag & drop. */
export class PageEditorState {
	root = $state<PageNode>(makeNode());
	selectedId = $state<string | null>(null);
	hoverId = $state<string | null>(null);
	drop = $state<Drop | null>(null);
	dragging: DragPayload | null = null;
	canUndo = $state(false);
	canRedo = $state(false);
	/** bumps when the inspector prompt field should grab focus */
	focusPrompt = $state(0);
	/** bumps when the inspector text field should grab focus */
	focusText = $state(0);
	/** open right-click menu */
	menu = $state<MenuState | null>(null);

	#undo: string[] = [];
	#redo: string[] = [];
	#lastKey = '';
	#lastAt = 0;
	#onChange: (json: string) => void;
	/** view-only: every mutation is ignored (copying still works) */
	readonly: boolean;

	constructor(content: string, onChange: (json: string) => void, readonly = false) {
		this.root = parsePage(content);
		this.#onChange = onChange;
		this.readonly = readonly;
	}

	get selected() {
		return this.selectedId ? findNode(this.root, this.selectedId) : null;
	}

	json() {
		return JSON.stringify($state.snapshot(this.root));
	}

	/** Call before a mutation. Rapid edits with the same key (typing) collapse into one undo step. */
	checkpoint(key = '') {
		const now = Date.now();
		if (key && key === this.#lastKey && now - this.#lastAt < 1000) {
			this.#lastAt = now;
			return;
		}
		this.#lastKey = key;
		this.#lastAt = now;
		this.#undo.push(this.json());
		if (this.#undo.length > 200) this.#undo.shift();
		this.#redo = [];
		this.canUndo = true;
		this.canRedo = false;
	}

	changed() {
		this.#onChange(this.json());
	}

	mutate(fn: () => void, key = '') {
		if (this.readonly) return;
		this.checkpoint(key);
		fn();
		this.changed();
	}

	undo() {
		const prev = this.#undo.pop();
		if (!prev) return;
		this.#redo.push(this.json());
		this.root = parsePage(prev);
		this.#lastKey = '';
		this.#sync();
	}

	redo() {
		const next = this.#redo.pop();
		if (!next) return;
		this.#undo.push(this.json());
		this.root = parsePage(next);
		this.#lastKey = '';
		this.#sync();
	}

	#sync() {
		this.canUndo = this.#undo.length > 0;
		this.canRedo = this.#redo.length > 0;
		if (this.selectedId && !findNode(this.root, this.selectedId)) this.selectedId = null;
		this.changed();
	}

	/** Replace the tree with a remote version (not added to history). */
	replace(content: string) {
		this.root = parsePage(content);
		if (this.selectedId && !findNode(this.root, this.selectedId)) this.selectedId = null;
	}

	// ---------- tree operations ----------

	insert(node: PageNode, parentId: string, index: number) {
		const parent = findNode(this.root, parentId);
		if (!parent) return;
		this.mutate(() => {
			parent.children.splice(Math.min(index, parent.children.length), 0, node);
		});
		this.selectedId = node.id;
	}

	move(id: string, parentId: string, index: number) {
		const node = findNode(this.root, id);
		const from = findParent(this.root, id);
		const to = findNode(this.root, parentId);
		if (!node || !from || !to || contains(node, parentId)) return;
		this.mutate(() => {
			const oldIndex = from.children.findIndex((c) => c.id === id);
			from.children.splice(oldIndex, 1);
			if (from.id === to.id && oldIndex < index) index--;
			to.children.splice(Math.min(index, to.children.length), 0, node);
		});
	}

	remove(id: string) {
		const parent = findParent(this.root, id);
		if (!parent) return;
		const i = parent.children.findIndex((c) => c.id === id);
		this.mutate(() => parent.children.splice(i, 1));
		const next = parent.children[i] ?? parent.children[i - 1];
		this.selectedId = next?.id ?? parent.id;
	}

	duplicate(id: string) {
		const parent = findParent(this.root, id);
		const node = findNode(this.root, id);
		if (!parent || !node) return;
		const copy = cloneWithNewIds($state.snapshot(node) as PageNode);
		const i = parent.children.findIndex((c) => c.id === id);
		this.insert(copy, parent.id, i + 1);
	}

	wrap(id: string) {
		const parent = findParent(this.root, id);
		const node = findNode(this.root, id);
		if (!parent || !node) return;
		const i = parent.children.findIndex((c) => c.id === id);
		const wrapper = makeNode({ tag: 'div', layout: { dir: parent.layout.dir === 'row' ? 'col' : 'row', gap: 8 } });
		this.mutate(() => {
			const [n] = parent.children.splice(i, 1);
			wrapper.children.push(n);
			parent.children.splice(i, 0, wrapper);
		});
		this.selectedId = wrapper.id;
	}

	unwrap(id: string) {
		const parent = findParent(this.root, id);
		const node = findNode(this.root, id);
		if (!parent || !node) return;
		const i = parent.children.findIndex((c) => c.id === id);
		this.mutate(() => parent.children.splice(i, 1, ...node.children));
		this.selectedId = parent.id;
	}

	shift(id: string, delta: number) {
		const parent = findParent(this.root, id);
		if (!parent) return;
		const i = parent.children.findIndex((c) => c.id === id);
		const j = i + delta;
		if (j < 0 || j >= parent.children.length) return;
		this.mutate(() => {
			const [n] = parent.children.splice(i, 1);
			parent.children.splice(j, 0, n);
		});
	}

	/** Add a blank element next to the selection (or inside it with `inside`, or into the page). */
	addBlank(kind: 'div' | 'text', inside = false) {
		const node = kind === 'div' ? makeNode({ tag: 'div' }) : makeNode({ tag: 'p', text: 'Text' });
		const sel = this.selected;
		const parent = sel ? findParent(this.root, sel.id) : null;
		if (!sel || !parent || (inside && !VOID_TAGS.has(sel.tag))) this.insert(node, sel?.id ?? this.root.id, Infinity);
		else this.insert(node, parent.id, parent.children.findIndex((c) => c.id === sel.id) + 1);
		if (kind === 'text') this.focusText++;
	}

	addChild(id: string) {
		this.insert(makeNode({ tag: 'div' }), id, Infinity);
	}

	copy(id: string) {
		const n = findNode(this.root, id);
		if (n) writeClipboard($state.snapshot(n) as PageNode);
	}

	cut(id: string) {
		if (id === this.root.id) return;
		this.copy(id);
		this.remove(id);
	}

	/** Paste after the selection, or `inside` it (at the end); the page itself always gets it inside. */
	paste(inside = false) {
		const clip = readClipboard();
		if (!clip) return;
		const node = cloneWithNewIds(clip);
		const sel = this.selected;
		const parent = sel ? findParent(this.root, sel.id) : null;
		if (sel && parent && !(inside && !VOID_TAGS.has(sel.tag))) this.insert(node, parent.id, parent.children.findIndex((c) => c.id === sel.id) + 1);
		else this.insert(node, sel?.id ?? this.root.id, Infinity);
	}

	/** Swap an element for another one in place (used when extracting it into its own page). */
	replaceNode(id: string, next: PageNode) {
		const parent = findParent(this.root, id);
		if (!parent) return;
		const i = parent.children.findIndex((c) => c.id === id);
		this.mutate(() => parent.children.splice(i, 1, next));
		this.selectedId = next.id;
	}

	/** Insert a library component next to the selection; into it if it's the page or an empty container. */
	addComponent(g: number, i: number) {
		const node = defToNode(LIBRARY[g].items[i]);
		const sel = this.selected;
		const parent = sel ? findParent(this.root, sel.id) : null;
		const emptyContainer = sel && !sel.children.length && !sel.text && !VOID_TAGS.has(sel.tag);
		if (!sel || !parent || emptyContainer) this.insert(node, sel?.id ?? this.root.id, Infinity);
		else this.insert(node, parent.id, parent.children.findIndex((c) => c.id === sel.id) + 1);
	}

	applyDrop(payload: DragPayload, drop: Drop) {
		if (payload.kind === 'comp') this.insert(defToNode(LIBRARY[payload.g].items[payload.i]), drop.parentId, drop.index);
		else {
			this.move(payload.id, drop.parentId, drop.index);
			this.selectedId = payload.id;
		}
	}
}
