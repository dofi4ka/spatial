import { error } from '@sveltejs/kit';
import { getProjectByExportToken } from '#lib/server/db.ts';
import { exportEntries } from '#lib/server/export.ts';
import { tarGz } from '#lib/server/tar.ts';

// Token-authenticated (no session) so it works from `curl`; the token is shown on the export page.

/** The project as a .tar.gz with everything under `.spatial/`. */
export function GET({ params }) {
	const project = getProjectByExportToken(params.token);
	if (!project) error(404, 'Unknown export link');
	const entries = [{ path: '.spatial', dir: true }, ...exportEntries(project).map((e) => ({ ...e, path: `.spatial/${e.path}` }))];
	const body = tarGz(entries, Math.floor(project.updated_at / 1000));
	return new Response(new Uint8Array(body), {
		headers: { 'content-type': 'application/gzip', 'content-disposition': 'attachment; filename="spatial.tar.gz"', 'cache-control': 'no-store' }
	});
}
