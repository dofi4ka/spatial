import { error, json } from '@sveltejs/kit';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { ctx } from '#lib/server/api.ts';
import { UPLOAD_DIR } from '#lib/server/db.ts';

const EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'image/avif': 'avif'
};

export async function POST(event) {
	ctx(event);
	const form = await event.request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) error(400, 'No file');
	const ext = EXT[file.type];
	if (!ext) error(400, 'Unsupported image type');
	if (file.size > 25 * 1024 * 1024) error(413, 'Image too large (25MB max)');
	const name = `${nanoid(16)}.${ext}`;
	writeFileSync(join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
	return json({ file: name });
}
