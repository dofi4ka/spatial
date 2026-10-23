import { error, json } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { ctx } from '#lib/server/api.ts';
import { deleteItems, getItem, insertItem, subtreeIds, updateItem, type ItemPatch } from '#lib/server/db.ts';
import { broadcast } from '#lib/server/hub.ts';
import type { Item, ItemType } from '#lib/types.ts';

const TYPES: ItemType[] = ['canvas', 'markdown', 'image', 'page', 'drawing', 'notebook'];

function assertCanvas(projectId: string, id: string | null | undefined) {
	const parent = id ? getItem(id) : undefined;
	if (!parent || parent.project_id !== projectId || parent.type !== 'canvas') error(400, 'Invalid parent canvas');
}

export async function POST(event) {
	const { user, project, origin, touch } = ctx(event);
	const body = (await event.request.json()) as Partial<Item>;
	if (!body.type || !TYPES.includes(body.type)) error(400, 'Invalid type');
	assertCanvas(project.id, body.parent_id);
	const item: Item = {
		id: body.id && /^[\w-]{6,32}$/.test(body.id) ? body.id : nanoid(12),
		project_id: project.id,
		parent_id: body.parent_id!,
		type: body.type,
		name: String(body.name ?? 'Untitled').slice(0, 200),
		x: Number(body.x) || 0,
		y: Number(body.y) || 0,
		w: Number(body.w) || 320,
		h: Number(body.h) || 240,
		content: String(body.content ?? ''),
		rev: 0,
		hidden: !!body.hidden,
		updated_at: Date.now(),
		updated_by: user.id
	};
	insertItem(item);
	touch();
	broadcast(project.id, { t: 'upsert', items: [item], origin, by: user.name });
	return json(item);
}

export async function PATCH(event) {
	const { user, project, origin, touch } = ctx(event);
	const { updates } = (await event.request.json()) as { updates: ItemPatch[] };
	// pages loaded before revisioned content writes existed; make them notice instead of losing edits
	if (updates?.some((u) => 'content' in u)) error(409, 'Spatial was updated. Reload the page to keep editing.');
	const out: Item[] = [];
	for (const u of updates ?? []) {
		const existing = getItem(u.id);
		if (!existing || existing.project_id !== project.id) continue;
		if ('parent_id' in u) {
			if (existing.parent_id === null) continue; // the root canvas cannot be moved
			assertCanvas(project.id, u.parent_id);
			if (subtreeIds(project.id, [u.id]).includes(u.parent_id!)) error(400, 'Cannot move a canvas into itself');
		}
		const updated = updateItem(u, user.id);
		if (updated) out.push(updated);
	}
	if (out.length) {
		touch();
		broadcast(project.id, { t: 'upsert', items: out, origin, by: user.name });
	}
	return json(out);
}

export async function DELETE(event) {
	const { user, project, origin, touch } = ctx(event);
	const { ids } = (await event.request.json()) as { ids: string[] };
	const valid = (ids ?? []).filter((id) => {
		const it = getItem(id);
		return it && it.project_id === project.id && it.parent_id !== null;
	});
	const all = subtreeIds(project.id, valid);
	deleteItems(all);
	touch();
	broadcast(project.id, { t: 'delete', ids: all, origin, by: user.name });
	return json({ ids: all });
}
