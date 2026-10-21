import { gzipSync } from 'node:zlib';

// Minimal ustar writer (+ PAX headers for long or non-ASCII paths), enough for `tar -xz`.

export type TarEntry = { path: string; data?: Buffer | string; dir?: boolean };

const BLOCK = 512;

function header(name: string, size: number, type: '0' | '5' | 'x', mtime: number) {
	const h = Buffer.alloc(BLOCK);
	const put = (s: string, off: number, len: number) => h.write(s.slice(0, len), off, len, 'utf8');
	const oct = (n: number, len: number) => n.toString(8).padStart(len - 1, '0') + '\0';
	put(name, 0, 100);
	put(oct(type === '5' ? 0o755 : 0o644, 8), 100, 8);
	put(oct(0, 8), 108, 8);
	put(oct(0, 8), 116, 8);
	put(oct(size, 12), 124, 12);
	put(oct(mtime, 12), 136, 12);
	h.fill(' ', 148, 156);
	put(type, 156, 1);
	put('ustar\0', 257, 6);
	put('00', 263, 2);
	let sum = 0;
	for (const b of h) sum += b;
	put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
	return h;
}

const pad = (n: number) => Buffer.alloc((BLOCK - (n % BLOCK)) % BLOCK);

/** PAX record "<len> path=<value>\n", where len counts the whole record. */
function paxRecord(key: string, value: string) {
	const body = ` ${key}=${value}\n`;
	let len = Buffer.byteLength(body);
	while (String(len).length + Buffer.byteLength(body) !== len) len = String(len).length + Buffer.byteLength(body);
	return `${len}${body}`;
}

export function tarGz(entries: TarEntry[], mtime = Math.floor(Date.now() / 1000)): Buffer {
	const parts: Buffer[] = [];
	for (const e of entries) {
		const name = e.dir && !e.path.endsWith('/') ? `${e.path}/` : e.path;
		const data = e.dir ? Buffer.alloc(0) : Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data ?? '', 'utf8');
		if (Buffer.byteLength(name) > 100 || /[^\x20-\x7e]/.test(name)) {
			const pax = Buffer.from(paxRecord('path', name), 'utf8');
			parts.push(header('PaxHeader', pax.length, 'x', mtime), pax, pad(pax.length));
		}
		const short = name.replace(/[^\x20-\x7e]/g, '_').slice(-100);
		parts.push(header(short, data.length, e.dir ? '5' : '0', mtime), data, pad(data.length));
	}
	parts.push(Buffer.alloc(BLOCK * 2));
	return gzipSync(Buffer.concat(parts));
}
