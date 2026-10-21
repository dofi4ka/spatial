import { fail, redirect } from '@sveltejs/kit';
import { ctx } from '#lib/server/api.ts';
import {
	addMember,
	clientProject,
	deleteProject,
	findUserByEmail,
	getProject,
	getUser,
	listMembers,
	removeMember,
	renameProject,
	setProjectDescription,
	setProjectVisibility
} from '#lib/server/db.ts';

export function load(event) {
	const { project, access } = ctx(event, 'edit');
	const owner = project.owner_id ? getUser(project.owner_id) : null;
	return { project: clientProject(project), access, owner, members: listMembers(project.id) };
}

export const actions = {
	general: async (event) => {
		const { project } = ctx(event, 'edit');
		const f = await event.request.formData();
		const name = String(f.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'The project needs a name' });
		if (name !== project.name) renameProject(project.id, name.slice(0, 120));
		setProjectDescription(project.id, String(f.get('description') ?? '').trim().slice(0, 1000));
		return { ok: 'Saved' };
	},
	visibility: async (event) => {
		const { project } = ctx(event, 'owner');
		const v = (await event.request.formData()).get('visibility') === 'public' ? 'public' : 'private';
		setProjectVisibility(project.id, v);
		return { ok: v === 'public' ? 'The project is now public' : 'The project is now private' };
	},
	add: async (event) => {
		const { project } = ctx(event, 'owner');
		const email = String((await event.request.formData()).get('email') ?? '').trim();
		const u = findUserByEmail(email);
		if (!u) return fail(400, { error: `No user with the email “${email}”. Ask an admin to create the account first.` });
		if (u.id === project.owner_id) return fail(400, { error: 'The owner already has access' });
		addMember(project.id, u.id);
		return { ok: `Added ${u.name}` };
	},
	remove: async (event) => {
		const { project, user, access } = ctx(event, 'edit');
		const id = String((await event.request.formData()).get('id'));
		// members may remove themselves; only the owner removes others
		if (id !== user.id && access !== 'owner') return fail(403, { error: 'Only the owner can remove members' });
		removeMember(project.id, id);
		if (id === user.id) redirect(303, getProject(project.id)?.visibility === 'public' ? `/p/${project.id}` : '/');
		return { ok: 'Removed' };
	},
	delete: async (event) => {
		const { project } = ctx(event, 'owner');
		deleteProject(project.id);
		redirect(303, '/');
	}
};
