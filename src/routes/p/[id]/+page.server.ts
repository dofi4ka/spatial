import { ctx } from '#lib/server/api.ts';
import { canEdit, clientProject, listItems } from '#lib/server/db.ts';

export function load(event) {
	const { project, access } = ctx(event, 'view');
	return { project: clientProject(project), items: listItems(project.id), access, canEdit: canEdit(access) };
}
