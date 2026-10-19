import { error } from '@sveltejs/kit';
import { getProject, listItems } from '#lib/server/db.ts';

export function load({ params }) {
	const project = getProject(params.id);
	if (!project) error(404, 'Project not found');
	return { project, items: listItems(project.id) };
}
