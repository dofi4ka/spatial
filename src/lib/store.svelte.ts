import { nanoid } from 'nanoid';
import type { Item, ItemType, Presence, Project, ServerEvent } from '#lib/types.ts';
import { mergeContent } from '#lib/merge.ts';

type Patch = Partial<Pick<Item, 'parent_id' | 'name' | 'x' | 'y' | 'w' | 'h' | 'hidden'>>;
export type Cursor = { canvas: string | null; file: string | null; x: number; y: number; t: number };
export type RemoteChange = { id: string; by: string; at: number };

export const DEFAULT_SIZE: Record<ItemType, [number, number]> = {
	canvas: [360, 260],
	markdown: [320, 380],
	drawing: [400, 300],
	image: [320, 240],
	page: [400, 300],
	notebook: [420, 340]
};

/** How an open editor exposes its document to ContentSync. */
export type Binding = {
	/** the editor's current content, including edits not reported yet */
	read(): string;
	/** replace the editor's content with a merged version (keep selection, skip undo history) */
	write(content: string): void;
};

/**
 * Keeps one item's content in sync with the server without losing anyone's edits.
 *
 * `base` is the latest server content we know (at revision `rev`). Local edits are sent on top
 * of `rev` a few times per second, one request at a time. When someone else's version arrives
 * (live, or as a 409 because they wrote first), our unsent edits are three-way merged into it,
 * the editor shows the result, and the merge is sent on top of the new revision.
 */
export class ContentSync {
	base: string;
	rev: number;
	binding: Binding | null = null;
	#store: ProjectStore;
	#id: string;
	#inflight: string | null = null;
	/** newest remote version that arrived while a write was in flight */
	#queued: Item | null = null;
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(store: ProjectStore, item: Item) {
		this.#store = store;
		this.#id = item.id;
		this.base = item.content;
		this.rev = item.rev;
	}

	get #item() {
		return this.#store.items[this.#id];
	}

	/** current local content: the open editor's, else the last thing it (or setContent) left */
	local() {
		return this.binding?.read() ?? this.#item?.content ?? this.base;
	}

	get dirty() {
		return this.#inflight !== null || this.local() !== this.base;
	}

	/** Call on every local change. `content` is optional when a binding can read it. */
	changed(content?: string) {
		const it = this.#item;
		if (!it || this.#store.readonly) return;
		it.content = content ?? this.local();
		this.#timer ??= setTimeout(() => this.send(), 60);
	}

	/** `initial`: the content the editor was created with; anything newer is written into it. */
	attach(b: Binding, initial: string) {
		this.binding = b;
		const c = this.#item?.content;
		if (c !== undefined && c !== initial) b.write(c);
	}

	detach(b: Binding) {
		if (this.binding !== b) return;
		const content = b.read();
		this.binding = null;
		if (this.#item && content !== this.#item.content) this.changed(content);
	}

	async send() {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
		if (this.#inflight !== null || !this.#item || this.#store.readonly) return;
		const content = this.local();
		if (this.#item.content !== content) this.#item.content = content;
		if (content === this.base) return;
		this.#inflight = content;
		const p = this.#store.project.id;
		let res: Response;
		try {
			res = await fetch(`/api/projects/${p}/items/${this.#id}/content`, {
				method: 'PUT',
				keepalive: content.length < 60000,
				headers: { 'content-type': 'application/json', 'x-client-id': this.#store.clientId },
				body: JSON.stringify({ rev: this.rev, content })
			});
		} catch {
			this.#inflight = null;
			this.#timer = setTimeout(() => this.send(), 1500);
			return;
		}
		this.#inflight = null;
		if (res.ok) {
			const { rev } = (await res.json()) as { rev: number };
			this.base = content;
			this.rev = rev;
			const q = this.#queued;
			this.#queued = null;
			if (q && q.rev > rev) this.#rebase(q);
		} else if (res.status === 409) {
			const { conflict } = (await res.json()) as { conflict: Item };
			const q = this.#queued;
			this.#queued = null;
			this.#rebase(q && q.rev > conflict.rev ? q : conflict);
		} else if (res.status === 404) {
			return;
		} else {
			this.#timer = setTimeout(() => this.send(), 3000);
			return;
		}
		if (this.local() !== this.base) this.#timer ??= setTimeout(() => this.send(), 60);
	}

	/** A newer server version of this item (live event, resync or conflict). */
	receive(remote: Item) {
		if (remote.rev <= this.rev) return;
		if (this.#inflight !== null) {
			if (!this.#queued || remote.rev > this.#queued.rev) this.#queued = remote;
			return;
		}
		this.#rebase(remote);
		if (this.local() !== this.base) this.#timer ??= setTimeout(() => this.send(), 60);
	}

	#rebase(remote: Item) {
		const local = this.local();
		const merged = mergeContent(remote.type, this.base, local, remote.content);
		this.base = remote.content;
		this.rev = remote.rev;
		if (merged !== local) this.binding?.write(merged);
		const it = this.#item;
		if (it) {
			it.rev = remote.rev;
			// an editor may normalize what it was given; keep what it actually shows
			it.content = this.binding?.read() ?? merged;
		}
	}
}

export class ProjectStore {
	project: Project;
	items = $state<Record<string, Item>>({});
	presence = $state<Presence[]>([]);
	cursors = $state<Record<string, Cursor>>({});
	connected = $state(false);
	/** last item changed by someone else — editors use this to refresh */
	remote = $state<RemoteChange | null>(null);
	clientId = nanoid();
	/** view-only access: editors hide their controls and nothing is sent to the server */
	readonly: boolean;

	byParent = $derived.by(() => {
		const m: Record<string, Item[]> = {};
		for (const it of Object.values(this.items)) if (it.parent_id) (m[it.parent_id] ??= []).push(it);
		return m;
	});

	#es: EventSource | null = null;
	#pending = new Map<string, Patch>();
	#syncs = new Map<string, ContentSync>();
	#flushTimer: ReturnType<typeof setTimeout> | null = null;
	#lastCursor = 0;

	constructor(project: Project, items: Item[], readonly = false) {
		this.project = project;
		this.readonly = readonly;
		for (const it of items) this.items[it.id] = it;
	}

	get rootId() {
		return this.project.root_id;
	}

	children(canvasId: string) {
		return this.byParent[canvasId] ?? [];
	}

	/** Chain of canvases from root to the given canvas. */
	path(canvasId: string): Item[] {
		const out: Item[] = [];
		let cur: Item | undefined = this.items[canvasId];
		while (cur) {
			out.unshift(cur);
			cur = cur.parent_id ? this.items[cur.parent_id] : undefined;
		}
		return out;
	}

	isAncestor(ancestorId: string, id: string) {
		let cur: Item | undefined = this.items[id];
		while (cur) {
			if (cur.id === ancestorId) return true;
			cur = cur.parent_id ? this.items[cur.parent_id] : undefined;
		}
		return false;
	}

	// ---------- networking ----------

	#fetch(path: string, init: RequestInit = {}) {
		return fetch(`/api/projects/${this.project.id}${path}`, {
			...init,
			headers: { 'content-type': 'application/json', 'x-client-id': this.clientId, ...init.headers }
		}).then(async (r) => {
			if (!r.ok) throw new Error((await r.text()) || r.statusText);
			return r.status === 204 ? null : r.json();
		});
	}

	connect() {
		this.#es = new EventSource(`/api/projects/${this.project.id}/events?client=${this.clientId}`);
		this.#es.onopen = () => {
			this.connected = true;
			this.resync();
		};
		this.#es.onerror = () => (this.connected = false);
		this.#es.onmessage = (e) => this.#apply(JSON.parse(e.data) as ServerEvent);
		return () => this.#es?.close();
	}

	/** After a reconnect, pull the full state to catch anything missed. */
	async resync() {
		const r = await fetch(`/p/${this.project.id}/items.json`);
		if (!r.ok) return;
		const items = (await r.json()) as Item[];
		const seen = new Set<string>();
		for (const it of items) {
			seen.add(it.id);
			this.#merge(it);
		}
		for (const id of Object.keys(this.items)) if (!seen.has(id)) delete this.items[id];
	}

	/** Takes a server version of an item, keeping local unsaved field and content changes. */
	#merge(it: Item, by?: string) {
		const local = this.#pending.get(it.id);
		const prev = this.items[it.id];
		const sync = this.#syncs.get(it.id);
		const content = prev?.content;
		this.items[it.id] = { ...it, ...local };
		if (sync && prev) {
			// content is owned by the sync: it merges the remote version into ours
			this.items[it.id].content = content!;
			this.items[it.id].rev = sync.rev;
			sync.receive(it);
		}
		if (prev && prev.content !== this.items[it.id].content) this.remote = { id: it.id, by: by ?? 'Someone', at: Date.now() };
	}

	/** The content sync of an item (created on first use). */
	sync(id: string) {
		let s = this.#syncs.get(id);
		if (!s && this.items[id]) this.#syncs.set(id, (s = new ContentSync(this, this.items[id])));
		return s!;
	}

	/** Set an item's content from outside an editor (e.g. a new image). */
	setContent(id: string, content: string) {
		if (this.items[id]) this.sync(id).changed(content);
	}

	#apply(ev: ServerEvent) {
		if (ev.t === 'presence') {
			this.presence = ev.users;
			for (const id of Object.keys(this.cursors)) if (!ev.users.some((u) => u.clientId === id)) delete this.cursors[id];
		} else if (ev.t === 'cursor') {
			this.cursors[ev.clientId] = { canvas: ev.canvas, file: ev.file, x: ev.x, y: ev.y, t: Date.now() };
		} else if (ev.origin === this.clientId) {
			return;
		} else if (ev.t === 'upsert') {
			for (const it of ev.items) this.#merge(it, ev.by);
		} else if (ev.t === 'delete') {
			for (const id of ev.ids) (delete this.items[id], this.#syncs.delete(id));
		}
	}

	sendCursor(canvas: string | null, file: string | null, x: number, y: number) {
		const now = Date.now();
		if (now - this.#lastCursor < 50) return;
		this.#lastCursor = now;
		this.#fetch('/cursor', { method: 'POST', body: JSON.stringify({ canvas, file, x, y }) }).catch(() => {});
	}

	// ---------- mutations (optimistic) ----------

	create(type: ItemType, parentId: string, x: number, y: number, extra: Partial<Item> = {}) {
		const [w, h] = DEFAULT_SIZE[type];
		const item: Item = {
			id: nanoid(12),
			project_id: this.project.id,
			parent_id: parentId,
			type,
			name: { canvas: 'New canvas', markdown: 'Untitled.md', image: 'Image', page: 'New page', drawing: 'New drawing', notebook: 'New notebook' }[type],
			x: Math.round(x - (extra.w ?? w) / 2),
			y: Math.round(y - (extra.h ?? h) / 2),
			w,
			h,
			content: '',
			rev: 0,
			hidden: false,
			updated_at: Date.now(),
			updated_by: null,
			...extra
		};
		this.items[item.id] = item;
		this.#fetch('/items', { method: 'POST', body: JSON.stringify(item) }).catch((e) => {
			delete this.items[item.id];
			alert(`Could not create item: ${e.message}`);
		});
		return item;
	}

	/** Apply locally right away; persist (batched) unless `persist` is false. */
	update(id: string, patch: Patch, persist = true) {
		const it = this.items[id];
		if (!it) return;
		Object.assign(it, patch);
		if (!persist || this.readonly) return;
		this.#pending.set(id, { ...this.#pending.get(id), ...patch });
		this.#flushTimer ??= setTimeout(() => this.flush(), 120);
	}

	async flush() {
		this.#flushTimer = null;
		const sends = Promise.all([...this.#syncs.values()].map((s) => s.send()));
		if (!this.#pending.size) return sends;
		const updates = [...this.#pending].map(([id, p]) => ({ id, ...p }));
		this.#pending.clear();
		try {
			await this.#fetch('/items', { method: 'PATCH', body: JSON.stringify({ updates }) });
		} catch (e) {
			alert(`Could not save changes: ${(e as Error).message}`);
			this.resync();
		}
		await sends;
	}

	remove(ids: string[]) {
		const all = new Set(ids);
		let grew = true;
		while (grew) {
			grew = false;
			for (const it of Object.values(this.items)) if (it.parent_id && all.has(it.parent_id) && !all.has(it.id)) (all.add(it.id), (grew = true));
		}
		for (const id of all) (delete this.items[id], this.#syncs.delete(id));
		this.#fetch('/items', { method: 'DELETE', body: JSON.stringify({ ids }) }).catch(() => this.resync());
	}

	async duplicate(ids: string[]) {
		await this.flush();
		const r = (await this.#fetch('/duplicate', { method: 'POST', body: JSON.stringify({ ids }) })) as { created: Item[]; top: string[] };
		for (const it of r.created) this.items[it.id] = it;
		return r.top;
	}

	async upload(file: File): Promise<string> {
		const fd = new FormData();
		fd.append('file', file);
		const r = await fetch(`/api/projects/${this.project.id}/upload`, { method: 'POST', body: fd });
		if (!r.ok) throw new Error(await r.text());
		return (await r.json()).file;
	}
}

export function imageSize(file: File): Promise<[number, number]> {
	return new Promise((res) => {
		const img = new Image();
		img.onload = () => {
			res([img.naturalWidth || 320, img.naturalHeight || 240]);
			URL.revokeObjectURL(img.src);
		};
		img.onerror = () => res([320, 240]);
		img.src = URL.createObjectURL(file);
	});
}

export function fitSize(w: number, h: number, max = 420): [number, number] {
	const s = Math.min(1, max / Math.max(w, h));
	return [Math.round(w * s), Math.round(h * s)];
}
