import { error } from '@sveltejs/kit';
import { getProjectByExportToken } from '#lib/server/db.ts';
import { agentsMd } from '#lib/server/export.ts';

/** Instructions for coding agents on how to use the exported `.spatial/` folder. */
export function GET({ params }) {
	if (!getProjectByExportToken(params.token)) error(404, 'Unknown export link');
	return new Response(agentsMd(), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } });
}
