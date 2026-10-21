import { ctx } from '#lib/server/api.ts';
import { canEdit, exportToken, rotateExportToken } from '#lib/server/db.ts';
import { exportEntries } from '#lib/server/export.ts';

export function load(event) {
	const { project, access } = ctx(event, 'view');
	const files = exportEntries(project)
		.filter((e) => !e.dir)
		.map((e) => ({ path: e.path, size: typeof e.data === 'string' ? Buffer.byteLength(e.data) : (e.data?.length ?? 0) }));
	return { project: { id: project.id, name: project.name }, token: exportToken(project.id)!, origin: event.url.origin, files, canEdit: canEdit(access) };
}

export const actions = {
	rotate: (event) => {
		const { project } = ctx(event, 'edit');
		rotateExportToken(project.id);
	}
};
