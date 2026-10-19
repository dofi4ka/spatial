import { fail } from '@sveltejs/kit';
import { createUser, deleteUser, findUserByEmail, isEnvAdmin, listUsers, setUserAdmin, setUserPassword } from '#lib/server/db.ts';

export function load() {
	return { users: listUsers().map((u) => ({ ...u, env_admin: isEnvAdmin(u.email) })) };
}

export const actions = {
	create: async ({ request }) => {
		const f = await request.formData();
		const email = String(f.get('email') ?? '').trim().toLowerCase();
		const name = String(f.get('name') ?? '').trim();
		const password = String(f.get('password') ?? '');
		if (!/^\S+@\S+$/.test(email)) return fail(400, { error: 'Enter a valid email' });
		if (password.length < 6) return fail(400, { error: 'Password must be at least 6 characters' });
		if (findUserByEmail(email)) return fail(400, { error: 'A user with this email already exists' });
		createUser(email, name || email.split('@')[0], password, f.get('is_admin') === 'on');
		return { ok: `Created ${email}` };
	},
	password: async ({ request }) => {
		const f = await request.formData();
		const password = String(f.get('password') ?? '');
		if (password.length < 6) return fail(400, { error: 'Password must be at least 6 characters' });
		setUserPassword(String(f.get('id')), password);
		return { ok: 'Password updated' };
	},
	admin: async ({ request, locals }) => {
		const f = await request.formData();
		const id = String(f.get('id'));
		if (id === locals.user!.id) return fail(400, { error: 'You cannot change your own role' });
		setUserAdmin(id, f.get('value') === '1');
	},
	delete: async ({ request, locals }) => {
		const id = String((await request.formData()).get('id'));
		const u = listUsers().find((u) => u.id === id);
		if (!u || id === locals.user!.id || isEnvAdmin(u.email)) return fail(400, { error: 'This user cannot be deleted' });
		deleteUser(id);
	}
};
