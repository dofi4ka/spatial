import { ctx } from '#lib/server/api.ts';
import { subscribe } from '#lib/server/hub.ts';

export function GET(event) {
	const { user, project } = ctx(event);
	const clientId = event.url.searchParams.get('client') || crypto.randomUUID();
	return new Response(subscribe(project.id, clientId, user), {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
}
