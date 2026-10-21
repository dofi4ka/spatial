import { fail, redirect } from '@sveltejs/kit';
import { createSession, createUser, findUserByEmail } from '#lib/server/db.ts';

export function load({ locals }) {
	if (locals.user) redirect(303, '/');
}

// Open registration: anyone can create an account, no email confirmation.
export const actions = {
	default: async ({ request, cookies, url }) => {
		const f = await request.formData();
		const email = String(f.get('email') ?? '').trim().toLowerCase();
		const name = String(f.get('name') ?? '').trim().slice(0, 80);
		const password = String(f.get('password') ?? '');
		if (!/^\S+@\S+\.\S+$/.test(email)) return fail(400, { email, name, error: 'Enter a valid email' });
		if (password.length < 8) return fail(400, { email, name, error: 'Password must be at least 8 characters' });
		if (findUserByEmail(email)) return fail(400, { email, name, error: 'An account with this email already exists — sign in instead' });
		const id = createUser(email, name || email.split('@')[0], password);
		const { token, maxAge } = createSession(id);
		cookies.set('sid', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge });
		redirect(303, '/');
	}
};
