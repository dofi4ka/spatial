import JSZip from 'jszip';
import { ctx } from '#lib/server/api.ts';
import { cleanName, exportEntries } from '#lib/server/export.ts';

/** The whole project as a .zip (for the signed-in "Download .zip" button). */
export async function GET(event) {
	const { project } = ctx(event, 'view');
	const rootName = cleanName(project.name);
	const zip = new JSZip();
	const root = zip.folder(rootName)!;
	for (const e of exportEntries(project)) {
		if (e.dir) root.folder(e.path);
		else root.file(e.path, e.data!);
	}
	const buf = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
	return new Response(buf, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="${rootName.replace(/[^\x20-\x7e]|"/g, '_')}.zip"; filename*=UTF-8''${encodeURIComponent(rootName)}.zip`
		}
	});
}
