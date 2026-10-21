import { error, type RequestEvent } from '@sveltejs/kit';
import type { Access } from '#lib/types.ts';
import { canEdit, getProject, projectAccess, touchProject } from './db';

/**
 * Resolves the project of an API request and checks the user may `need` it:
 * 'view' for reads, 'edit' (the default) for changes, 'owner' for settings.
 * Projects the user can't see answer 404, so their existence isn't revealed.
 */
export function ctx(event: RequestEvent, need: Access = 'edit') {
	const user = event.locals.user;
	if (!user) error(401, 'Unauthorized');
	const project = getProject(event.params.id!);
	const access = project ? projectAccess(project, user) : null;
	if (!project || !access) error(404, 'Project not found');
	if (need === 'edit' && !canEdit(access)) error(403, 'You can view this project but not edit it');
	if (need === 'owner' && access !== 'owner') error(403, 'Only the owner can do this');
	const origin = event.request.headers.get('x-client-id') ?? undefined;
	return { user, project, access, origin, touch: () => touchProject(project.id) };
}
