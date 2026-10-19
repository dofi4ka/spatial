import { json } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { ctx } from '#lib/server/api.ts';
import { getItem, insertItem, listItems } from '#lib/server/db.ts';
import { broadcast } from '#lib/server/hub.ts';
import type { Item } from '#lib/types.ts';

/** Deep-copies items (canvases include their whole subtree), offset by dx/dy. */
export async function POST(event) {
	const { user, project, origin, touch } = ctx(event);
	const { ids, dx = 40, dy = 40 } = (await event.request.json()) as { ids: string[]; dx?: number; dy?: number };
	const all = listItems(project.id);
	const children = new Map<string, Item[]>();
	for (const it of all) if (it.parent_id) (children.get(it.parent_id) ?? children.set(it.parent_id, []).get(it.parent_id)!).push(it);

	const created: Item[] = [];
	const topIds: string[] = [];
	const copy = (src: Item, parent: string, top: boolean) => {
		const item: Item = {
			...src,
			id: nanoid(12),
			parent_id: parent,
			name: top ? `${src.name} copy` : src.name,
			x: top ? src.x + dx : src.x,
			y: top ? src.y + dy : src.y,
			updated_at: Date.now(),
			updated_by: user.id
		};
		insertItem(item);
		created.push(item);
		if (top) topIds.push(item.id);
		for (const c of children.get(src.id) ?? []) copy(c, item.id, false);
	};
	for (const id of ids ?? []) {
		const src = getItem(id);
		if (src && src.project_id === project.id && src.parent_id) copy(src, src.parent_id, true);
	}
	touch();
	broadcast(project.id, { t: 'upsert', items: created, origin, by: user.name });
	return json({ created, top: topIds });
}
