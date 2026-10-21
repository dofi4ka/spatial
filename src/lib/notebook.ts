// Notebook items: a list of Python cells (code or markdown) that run in the browser via Pyodide.
// The last outputs are stored with the notebook so the canvas preview and collaborators see them.
// On export a notebook becomes a percent-format .py file ("# %%" cells), which diffs cleanly.

export type OutputKind = 'stdout' | 'stderr' | 'result' | 'error' | 'html' | 'svg' | 'image';
export type Output = { t: OutputKind; v: string };
export type Cell = { id: string; kind: 'code' | 'md'; src: string; outputs: Output[] };
export type Notebook = { cells: Cell[] };

export const cellId = () => Math.random().toString(36).slice(2, 10);
export const makeCell = (kind: Cell['kind'] = 'code', src = ''): Cell => ({ id: cellId(), kind, src, outputs: [] });

export function parseNotebook(content: string): Notebook {
	try {
		const n = JSON.parse(content);
		if (n && Array.isArray(n.cells))
			return {
				cells: n.cells.map((c: Partial<Cell>) => ({
					id: c.id || cellId(),
					kind: c.kind === 'md' ? 'md' : 'code',
					src: String(c.src ?? ''),
					outputs: Array.isArray(c.outputs) ? c.outputs : []
				}))
			};
	} catch {
		/* empty or invalid */
	}
	return { cells: [makeCell()] };
}

/** Outputs kept in the stored notebook are capped so one huge plot can't bloat every sync. */
const MAX_STORED = 1_500_000;

export function compactOutputs(outputs: Output[]): Output[] {
	const merged: Output[] = [];
	for (const o of outputs) {
		const last = merged.at(-1);
		if (last && (o.t === 'stdout' || o.t === 'stderr') && last.t === o.t) last.v += o.v;
		else merged.push({ ...o });
	}
	let size = 0;
	return merged.map((o) => {
		size += o.v.length;
		if (size <= MAX_STORED) return o;
		return o.t === 'image' || o.t === 'html' || o.t === 'svg' ? { t: 'stderr', v: '[output too large to keep — run the cell to see it]\n' } : { ...o, v: o.v.slice(0, 2000) + '\n…' };
	});
}

/** Percent-format Python script (understood by VS Code, Jupytext, Spyder, PyCharm). */
export function notebookToPy(nb: Notebook): string {
	return (
		nb.cells
			.filter((c) => c.src.trim())
			.map((c) =>
				c.kind === 'md'
					? `# %% [markdown]\n${c.src
							.trimEnd()
							.split('\n')
							.map((l) => (l ? `# ${l}` : '#'))
							.join('\n')}`
					: `# %%\n${c.src.trimEnd()}`
			)
			.join('\n\n') + '\n'
	);
}

/** The first picture among a notebook's outputs (for previews). */
export function firstImage(nb: Notebook): string | null {
	for (const c of nb.cells) for (const o of c.outputs) if (o.t === 'image') return o.v;
	return null;
}
