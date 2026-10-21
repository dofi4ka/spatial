import { ctx } from '#lib/server/api.ts';
import { broadcast } from '#lib/server/hub.ts';

export async function POST(event) {
	const { project, origin } = ctx(event, 'view');
	const b = await event.request.json();
	if (origin) broadcast(project.id, { t: 'cursor', clientId: origin, canvas: b.canvas ?? null, file: b.file ?? null, x: +b.x || 0, y: +b.y || 0 }, origin);
	return new Response(null, { status: 204 });
}
