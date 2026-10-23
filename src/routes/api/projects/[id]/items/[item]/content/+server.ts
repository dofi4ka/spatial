import { error, json } from '@sveltejs/kit';
import { ctx } from '#lib/server/api.ts';
import { getItem, setContent } from '#lib/server/db.ts';
import { broadcast } from '#lib/server/hub.ts';

/**
 * Writes an item's content on top of revision `rev`. If someone else wrote in between, answers
 * 409 with the current item so the client can merge its changes into it and try again.
 */
export async function PUT(event) {
	const { user, project, origin, touch } = ctx(event);
	const { rev, content } = (await event.request.json()) as { rev: number; content: string };
	const item = getItem(event.params.item);
	if (!item || item.project_id !== project.id) error(404, 'Item not found');
	if (typeof content !== 'string' || typeof rev !== 'number') error(400, 'Expected { rev, content }');
	const updated = setContent(item.id, rev, content, user.id);
	if (!updated) return json({ conflict: getItem(item.id) }, { status: 409 });
	touch();
	broadcast(project.id, { t: 'upsert', items: [updated], origin, by: user.name });
	return json({ rev: updated.rev });
}
