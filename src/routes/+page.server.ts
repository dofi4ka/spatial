import { fail, redirect } from '@sveltejs/kit';
import { createProject, deleteProject, listProjects, renameProject } from '#lib/server/db.ts';

export function load() {
	return { projects: listProjects() };
}

export const actions = {
	create: async ({ request, locals }) => {
		const name = String((await request.formData()).get('name') ?? '').trim() || 'Untitled project';
		const id = createProject(name.slice(0, 120), locals.user!.id);
		redirect(303, `/p/${id}`);
	},
	rename: async ({ request }) => {
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		if (!name) return fail(400);
		renameProject(String(f.get('id')), name.slice(0, 120));
	},
	delete: async ({ request, locals }) => {
		if (!locals.user?.is_admin) return fail(403, { error: 'Only admins can delete projects' });
		deleteProject(String((await request.formData()).get('id')));
	}
};
