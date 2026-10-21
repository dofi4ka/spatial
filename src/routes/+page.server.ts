import { redirect } from '@sveltejs/kit';
import { createProject, listPublicProjects, listUserProjects } from '#lib/server/db.ts';

export function load({ locals }) {
	const user = locals.user!;
	const mine = listUserProjects(user.id);
	return {
		owned: mine.filter((p) => p.owner_id === user.id),
		shared: mine.filter((p) => p.owner_id !== user.id),
		discover: listPublicProjects(user.id)
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim() || 'Untitled project';
		const description = String(f.get('description') ?? '').trim();
		const visibility = f.get('visibility') === 'public' ? 'public' : 'private';
		const id = createProject(name.slice(0, 120), locals.user!.id, description.slice(0, 1000), visibility);
		redirect(303, `/p/${id}`);
	}
};
