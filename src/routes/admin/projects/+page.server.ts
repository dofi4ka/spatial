import { deleteProject, listAllProjects } from '#lib/server/db.ts';

// /admin is admin-only (see hooks.server.ts)
export function load() {
	return { projects: listAllProjects() };
}

export const actions = {
	delete: async ({ request }) => {
		deleteProject(String((await request.formData()).get('id')));
	}
};
