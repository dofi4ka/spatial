import { error } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { UPLOAD_DIR } from '#lib/server/db.ts';

const TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	avif: 'image/avif'
};

export function GET({ params }) {
	if (!/^[\w-]+\.(png|jpg|gif|webp|svg|avif)$/.test(params.file)) error(404);
	const path = join(UPLOAD_DIR, params.file);
	if (!existsSync(path)) error(404);
	const ext = params.file.split('.').pop()!;
	return new Response(readFileSync(path), {
		headers: {
			'content-type': TYPES[ext],
			'cache-control': 'private, max-age=31536000, immutable',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
		}
	});
}
