import { error, type RequestEvent } from '@sveltejs/kit';
import { getProject, touchProject } from './db';

export function ctx(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) error(401, 'Unauthorized');
	const project = getProject(event.params.id!);
	if (!project) error(404, 'Project not found');
	const origin = event.request.headers.get('x-client-id') ?? undefined;
	return { user, project, origin, touch: () => touchProject(project.id) };
}
