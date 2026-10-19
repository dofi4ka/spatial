import { nanoid } from 'nanoid';
import type { Item, ItemType, Presence, Project, ServerEvent } from '#lib/types.ts';

type Patch = Partial<Pick<Item, 'parent_id' | 'name' | 'x' | 'y' | 'w' | 'h' | 'content'>>;
export type Cursor = { canvas: string | null; file: string | null; x: number; y: number; t: number };
export type RemoteChange = { id: string; by: string; at: number };

export const DEFAULT_SIZE: Record<ItemType, [number, number]> = {
	canvas: [360, 260],
	markdown: [320, 380],
	image: [320, 240],
	page: [400, 300]
};

export class ProjectStore {
	project: Project;
	items = $state<Record<string, Item>>({});
	presence = $state<Presence[]>([]);
	cursors = $state<Record<string, Cursor>>({});
	connected = $state(false);
	/** last item changed by someone else — editors use this to refresh */
	remote = $state<RemoteChange | null>(null);
	clientId = nanoid();

	byParent = $derived.by(() => {
		const m: Record<string, Item[]> = {};
		for (const it of Object.values(this.items)) if (it.parent_id) (m[it.parent_id] ??= []).push(it);
		return m;
	});

	#es: EventSource | null = null;
	#pending = new Map<string, Patch>();
	#flushTimer: ReturnType<typeof setTimeout> | null = null;
	#lastCursor = 0;

	constructor(project: Project, items: Item[]) {
		this.project = project;
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
			if (!this.#pending.has(it.id)) this.items[it.id] = it;
		}
		for (const id of Object.keys(this.items)) if (!seen.has(id)) delete this.items[id];
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
			for (const it of ev.items) {
				const local = this.#pending.get(it.id);
				const prev = this.items[it.id];
				this.items[it.id] = local ? { ...it, ...local } : it;
				if (prev && prev.content !== it.content) this.remote = { id: it.id, by: ev.by ?? 'Someone', at: Date.now() };
			}
		} else if (ev.t === 'delete') {
			for (const id of ev.ids) delete this.items[id];
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
			name: { canvas: 'New canvas', markdown: 'Untitled.md', image: 'Image', page: 'New page' }[type],
			x: Math.round(x - (extra.w ?? w) / 2),
			y: Math.round(y - (extra.h ?? h) / 2),
			w,
			h,
			content: '',
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
		if (!persist) return;
		this.#pending.set(id, { ...this.#pending.get(id), ...patch });
		this.#flushTimer ??= setTimeout(() => this.flush(), 120);
	}

	async flush() {
		this.#flushTimer = null;
		if (!this.#pending.size) return;
		const updates = [...this.#pending].map(([id, p]) => ({ id, ...p }));
		this.#pending.clear();
		try {
			await this.#fetch('/items', { method: 'PATCH', body: JSON.stringify({ updates }) });
		} catch (e) {
			alert(`Could not save changes: ${(e as Error).message}`);
			this.resync();
		}
	}

	remove(ids: string[]) {
		const all = new Set(ids);
		let grew = true;
		while (grew) {
			grew = false;
			for (const it of Object.values(this.items)) if (it.parent_id && all.has(it.parent_id) && !all.has(it.id)) (all.add(it.id), (grew = true));
		}
		for (const id of all) delete this.items[id];
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
