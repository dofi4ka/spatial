import { error, json } from '@sveltejs/kit';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ctx } from '#lib/server/api.ts';
import { getItem, UPLOAD_DIR } from '#lib/server/db.ts';

const PNG = [0x89, 0x50, 0x4e, 0x47];

/** Stores the PNG render of a drawing (overwriting the previous one). */
export async function POST(event) {
	const { project } = ctx(event);
	const item = getItem(event.params.item);
	if (!item || item.project_id !== project.id || item.type !== 'drawing') error(404, 'Drawing not found');
	const buf = Buffer.from(await event.request.arrayBuffer());
	if (buf.length > 25 * 1024 * 1024) error(413, 'Render too large');
	if (!PNG.every((b, i) => buf[i] === b)) error(400, 'Expected a PNG');
	const file = `drawing-${item.id}.png`;
	writeFileSync(join(UPLOAD_DIR, file), buf);
	return json({ file, at: Date.now() });
}
