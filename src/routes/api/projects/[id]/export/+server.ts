import JSZip from 'jszip';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ctx } from '#lib/server/api.ts';
import { listItems, UPLOAD_DIR } from '#lib/server/db.ts';
import { pageToHtml, parsePage } from '#lib/page.ts';
import { exportMarkdown, planExport, resolverFor } from '#lib/mentions.ts';

const clean = (s: string) => s.replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/^\.+/, '').trim() || 'untitled';

export async function GET(event) {
	const { project } = ctx(event);
	const items = listItems(project.id);
	const plan = planExport(items, project.root_id);
	const rootName = clean(project.name);
	const zip = new JSZip();
	const root = zip.folder(rootName)!;
	const upload = (file: string) => {
		const path = join(UPLOAD_DIR, file);
		return existsSync(path) ? readFileSync(path) : null;
	};

	for (const it of items) {
		const path = plan.paths.get(it.id);
		if (path === undefined || it.id === project.root_id) continue;
		if (it.type === 'canvas') root.folder(path);
		else if (it.type === 'markdown') {
			root.file(path, exportMarkdown(it.content, it.id, plan));
			for (const [file, assetPath] of plan.assets.get(it.id) ?? []) {
				const data = upload(file);
				if (data) root.file(assetPath, data);
			}
		} else if (it.type === 'page') root.file(path, pageToHtml(parsePage(it.content), it.name, resolverFor(plan, it.id)));
		else if (it.type === 'image') {
			const data = upload(it.content);
			if (data) root.file(path, data);
		}
	}

	const buf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
	return new Response(buf, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="${rootName.replace(/[^\x20-\x7e]|"/g, '_')}.zip"; filename*=UTF-8''${encodeURIComponent(rootName)}.zip`
		}
	});
}
