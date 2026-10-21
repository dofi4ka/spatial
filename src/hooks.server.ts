import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { ensureAdmin, getSessionUser, migrateOwnership } from '#lib/server/db.ts';

ensureAdmin();
migrateOwnership();

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('sid');
	event.locals.user = token ? getSessionUser(token) : null;

	const path = event.url.pathname;
	// /export/<token>/… authenticates with the token in the URL (for curl)
	if (!event.locals.user && path !== '/login' && path !== '/signup' && !path.startsWith('/export/')) {
		if (path.startsWith('/api/') || path.startsWith('/uploads/')) return new Response('Unauthorized', { status: 401 });
		redirect(303, '/login');
	}
	if (path.startsWith('/admin') && !event.locals.user?.is_admin) redirect(303, '/');

	return resolve(event);
};
