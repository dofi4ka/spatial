import { fail, redirect } from '@sveltejs/kit';
import { createSession, findUserByEmail, verifyPassword } from '#lib/server/db.ts';

export function load({ locals }) {
	if (locals.user) redirect(303, '/');
}

export const actions = {
	default: async ({ request, cookies, url }) => {
		const f = await request.formData();
		const email = String(f.get('email') ?? '');
		const password = String(f.get('password') ?? '');
		const user = findUserByEmail(email);
		if (!user || !verifyPassword(password, user.password_hash)) return fail(400, { email, error: 'Invalid email or password' });
		const { token, maxAge } = createSession(user.id);
		cookies.set('sid', token, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge });
		redirect(303, '/');
	}
};
