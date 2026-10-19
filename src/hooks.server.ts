import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { ensureAdmin, getSessionUser } from '#lib/server/db.ts';

ensureAdmin();

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('sid');
	event.locals.user = token ? getSessionUser(token) : null;

	const path = event.url.pathname;
	if (!event.locals.user && path !== '/login') {
		if (path.startsWith('/api/') || path.startsWith('/uploads/')) return new Response('Unauthorized', { status: 401 });
		redirect(303, '/login');
	}
	if (path.startsWith('/admin') && !event.locals.user?.is_admin) redirect(303, '/');

	return resolve(event);
};
