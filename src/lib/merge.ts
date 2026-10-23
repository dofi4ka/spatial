// Three-way merge of item content, used to rebase local edits onto changes made by others.
//
// Every client keeps the last content it got from the server (`base`). When someone else's
// version arrives, local = merge(base, local, remote): both sides' changes are kept.
//  - text (markdown, and any string inside JSON that both sides changed): character-level merge
//  - JSON objects: key by key
//  - arrays of objects with an `id` (cells, page children, Excalidraw elements): element by id;
//    Excalidraw elements carry a `version`, and the newer one wins as a whole
//  - anything else both sides changed: the local value wins
import DiffMatchPatch from 'diff-match-patch';
import type { ItemType } from './types.ts';

const dmp = new DiffMatchPatch();
dmp.Diff_Timeout = 0.25;

type J = unknown;
const isObj = (v: J): v is Record<string, J> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasId = (v: J): v is Record<string, J> & { id: string } => isObj(v) && typeof v.id === 'string';

function eq(a: J, b: J): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b || !a || !b || typeof a !== 'object') return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) {
		const bb = b as J[];
		return a.length === bb.length && a.every((x, i) => eq(x, bb[i]));
	}
	const ka = Object.keys(a as object);
	const kb = Object.keys(b as object);
	return ka.length === kb.length && ka.every((k) => eq((a as Record<string, J>)[k], (b as Record<string, J>)[k]));
}

/** A replacement of base[from, to) with `text`. */
type Edit = { from: number; to: number; text: string };

/** Exact edits turning `a` into `b`, in order, in `a`'s coordinates. */
function edits(a: string, b: string): Edit[] {
	const out: Edit[] = [];
	let pos = 0;
	for (const [op, text] of dmp.diff_main(a, b)) {
		const last = out.at(-1);
		const open = last && last.to === pos;
		if (op === 0) pos += text.length;
		else if (op === -1) {
			if (open) last.to += text.length;
			else out.push({ from: pos, to: pos + text.length, text: '' });
			pos += text.length;
		} else if (open) last.text += text;
		else out.push({ from: pos, to: pos, text });
	}
	return out;
}

/**
 * Where base position `x` ends up after `remote` edits. `assoc` > 0: after text the remote side
 * inserted at that spot (used for the start of a local edit), < 0: before it (for the end).
 */
function mapPos(x: number, remote: Edit[], assoc: number) {
	let delta = 0;
	for (const e of remote) {
		if (e.to < x || (e.to === x && (e.from < e.to || assoc > 0))) delta += e.text.length - (e.to - e.from);
		else if (e.from < x) return e.from + delta + (assoc > 0 ? e.text.length : 0);
		else break;
	}
	return x + delta;
}

/**
 * Applies the local changes (base → local) on top of remote. Edits in different places all
 * survive; concurrent inserts at one spot keep both (local first); where both sides rewrote the
 * same text, the local rewrite wins.
 */
export function mergeText(base: string, local: string, remote: string): string {
	if (local === remote || base === remote) return local;
	if (base === local) return remote;
	const R = edits(base, remote);
	const same = new Set(R.map((e) => `${e.from}:${e.to}:${e.text}`));
	const L: Edit[] = [];
	for (const e of edits(base, local)) {
		if (same.has(`${e.from}:${e.to}:${e.text}`)) continue;
		// a pure local insert goes before remote text inserted at the same spot
		if (e.from === e.to) {
			const at = mapPos(e.from, R, -1);
			L.push({ from: at, to: at, text: e.text });
			continue;
		}
		// a local deletion or rewrite skips over text remote inserted inside its range
		const inside = R.filter((r) => r.text && r.from >= e.from && r.to <= e.to && !(r.from === r.to && (r.from === e.from || r.to === e.to)));
		let cursor = e.from;
		let text = e.text;
		for (const piece of [...inside.map((r) => [r.from, r.to]), [e.to, e.to]]) {
			const from = mapPos(cursor, R, 1);
			L.push({ from, to: Math.max(from, mapPos(piece[0], R, -1)), text });
			text = '';
			cursor = piece[1];
		}
	}
	let out = remote;
	for (let i = L.length - 1; i >= 0; i--) out = out.slice(0, L[i].from) + L[i].text + out.slice(L[i].to);
	return out;
}

function mergeArray(base: J[] | undefined, local: J[], remote: J[]): J[] {
	const b = base ?? [];
	if (![b, local, remote].every((a) => a.every(hasId))) return local;
	const B = new Map(b.map((x) => [(x as { id: string }).id, x]));
	const L = new Map(local.map((x) => [(x as { id: string }).id, x]));
	const R = new Map(remote.map((x) => [(x as { id: string }).id, x]));

	// remote's order, with elements added locally inserted after their local predecessor
	const order = remote.map((x) => (x as { id: string }).id);
	let prev: string | null = null;
	for (const x of local) {
		const id = (x as { id: string }).id;
		if (!R.has(id) && !B.has(id)) {
			const at: number = prev === null ? 0 : order.indexOf(prev) + 1;
			order.splice(at, 0, id);
		}
		if (order.includes(id)) prev = id;
	}
	// a reorder made locally wins over remote's order when remote didn't reorder
	const ids = (a: J[]) => a.map((x) => (x as { id: string }).id).join('\n');
	if (ids(b) === ids(remote) && ids(b) !== ids(local)) {
		const extra = order.filter((id) => !L.has(id));
		order.splice(0, order.length, ...local.map((x) => (x as { id: string }).id), ...extra);
	}

	const out: J[] = [];
	for (const id of new Set(order)) {
		const bv = B.get(id);
		const lv = L.get(id);
		const rv = R.get(id);
		if (lv === undefined && rv === undefined) continue;
		if (lv === undefined) {
			// deleted locally: stays deleted unless remote changed it meanwhile
			if (bv !== undefined && eq(bv, rv)) continue;
			out.push(rv);
		} else if (rv === undefined) {
			if (bv !== undefined && eq(bv, lv)) continue;
			out.push(lv);
		} else out.push(mergeElement(bv, lv, rv));
	}
	return out;
}

function mergeElement(base: J, local: J, remote: J): J {
	// Excalidraw elements: each edit bumps `version`; take the newer element whole
	if (isObj(local) && isObj(remote) && typeof local.version === 'number' && typeof remote.version === 'number') {
		if (eq(local, remote)) return local;
		if (isObj(base) && eq(base, local)) return remote;
		if (isObj(base) && eq(base, remote)) return local;
		if (local.version !== remote.version) return local.version > remote.version ? local : remote;
		return Number(local.versionNonce) <= Number(remote.versionNonce) ? local : remote;
	}
	return mergeValue(base, local, remote);
}

export function mergeValue(base: J, local: J, remote: J): J {
	if (eq(local, remote) || eq(base, remote)) return local;
	if (eq(base, local)) return remote;
	if (typeof local === 'string' && typeof remote === 'string') return mergeText(typeof base === 'string' ? base : '', local, remote);
	if (Array.isArray(local) && Array.isArray(remote)) return mergeArray(Array.isArray(base) ? base : undefined, local, remote);
	if (isObj(local) && isObj(remote)) {
		const b = isObj(base) ? base : {};
		const out: Record<string, J> = {};
		for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
			const v = k in local ? (k in remote ? mergeValue(b[k], local[k], remote[k]) : k in b && eq(b[k], local[k]) ? undefined : local[k]) : k in b && eq(b[k], remote[k]) ? undefined : remote[k];
			if (v !== undefined) out[k] = v;
		}
		return out;
	}
	return local;
}

/** A node moved locally while edited remotely can show up twice: keep the first. */
function dedupeTree(node: J, seen = new Set<string>()): J {
	if (!isObj(node) || !Array.isArray(node.children)) return node;
	if (typeof node.id === 'string') seen.add(node.id);
	const children = node.children.filter((c) => !hasId(c) || !seen.has(c.id));
	for (const c of children) if (hasId(c)) seen.add(c.id);
	return { ...node, children: children.map((c) => dedupeTree(c, seen)) };
}

/** Merges content of an item of the given type. Never throws; falls back to the local version. */
export function mergeContent(type: ItemType, base: string, local: string, remote: string): string {
	if (local === remote || base === remote) return local;
	if (base === local) return remote;
	if (type === 'markdown') return mergeText(base, local, remote);
	if (type === 'page' || type === 'drawing' || type === 'notebook') {
		try {
			const parse = (s: string) => (s ? JSON.parse(s) : {});
			let merged = mergeValue(parse(base), parse(local), parse(remote));
			if (type === 'page') merged = dedupeTree(merged);
			return JSON.stringify(merged);
		} catch {
			return local;
		}
	}
	return local;
}
