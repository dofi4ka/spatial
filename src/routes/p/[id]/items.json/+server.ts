import { json } from '@sveltejs/kit';
import { ctx } from '#lib/server/api.ts';
import { listItems } from '#lib/server/db.ts';

export function GET(event) {
	const { project } = ctx(event, 'view');
	return json(listItems(project.id));
}
