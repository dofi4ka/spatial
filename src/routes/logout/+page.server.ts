import { redirect } from '@sveltejs/kit';
import { deleteSession } from '#lib/server/db.ts';

export const actions = {
	default: ({ cookies }) => {
		const t = cookies.get('sid');
		if (t) deleteSession(t);
		cookies.delete('sid', { path: '/' });
		redirect(303, '/login');
	}
};
