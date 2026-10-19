import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { nanoid } from 'nanoid';
import type { Item, Project, User } from '#lib/types.ts';

// Load .env (does not override variables already set in the environment)
if (existsSync('.env')) process.loadEnvFile('.env');
const env = process.env;

export const DATA_DIR = resolve(env.DATA_DIR || './data');
export const UPLOAD_DIR = join(DATA_DIR, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const g = globalThis as unknown as { __spatial_db?: DatabaseSync };

function open() {
	const db = new DatabaseSync(join(DATA_DIR, 'spatial.db'));
	db.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA foreign_keys = ON;
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			is_admin INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			root_id TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS items (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			parent_id TEXT,
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			x REAL NOT NULL DEFAULT 0,
			y REAL NOT NULL DEFAULT 0,
			w REAL NOT NULL DEFAULT 320,
			h REAL NOT NULL DEFAULT 240,
			content TEXT NOT NULL DEFAULT '',
			updated_at INTEGER NOT NULL,
			updated_by TEXT
		);
		CREATE INDEX IF NOT EXISTS items_project ON items(project_id);
	`);
	return db;
}

export const db = (g.__spatial_db ??= open());

// ---------- passwords ----------

export function hashPassword(pw: string) {
	const salt = randomBytes(16);
	const hash = scryptSync(pw, salt, 64);
	return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string) {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const actual = scryptSync(pw, Buffer.from(salt, 'hex'), 64);
	const expected = Buffer.from(hash, 'hex');
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------- users ----------

type UserRow = { id: string; email: string; name: string; password_hash: string; is_admin: number };

const toUser = (r: UserRow): User => ({ id: r.id, email: r.email, name: r.name, is_admin: !!r.is_admin });

/** Ensures the admin account configured via ADMIN_EMAIL / ADMIN_PASSWORD exists and matches env. */
export function ensureAdmin() {
	const email = env.ADMIN_EMAIL?.trim().toLowerCase();
	const password = env.ADMIN_PASSWORD;
	if (!email || !password) {
		console.warn('[spatial] ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin account configured');
		return;
	}
	const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
	if (!row) {
		db.prepare(
			'INSERT INTO users (id, email, name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, 1, ?)'
		).run(nanoid(12), email, 'Admin', hashPassword(password), Date.now());
	} else if (!verifyPassword(password, row.password_hash) || !row.is_admin) {
		db.prepare('UPDATE users SET password_hash = ?, is_admin = 1 WHERE id = ?').run(hashPassword(password), row.id);
	}
}

export function isEnvAdmin(email: string) {
	return email === env.ADMIN_EMAIL?.trim().toLowerCase();
}

export function findUserByEmail(email: string) {
	return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as UserRow | undefined;
}

export function listUsers() {
	return (db.prepare('SELECT * FROM users ORDER BY created_at').all() as UserRow[]).map(toUser);
}

export function createUser(email: string, name: string, password: string, isAdmin = false) {
	const id = nanoid(12);
	db.prepare(
		'INSERT INTO users (id, email, name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)'
	).run(id, email.trim().toLowerCase(), name.trim() || email, hashPassword(password), isAdmin ? 1 : 0, Date.now());
	return id;
}

export function deleteUser(id: string) {
	db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function setUserPassword(id: string, password: string) {
	db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
	db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
}

export function setUserAdmin(id: string, isAdmin: boolean) {
	db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id);
}

// ---------- sessions ----------

const SESSION_TTL = 1000 * 60 * 60 * 24 * 30;

export function createSession(userId: string) {
	const token = randomBytes(32).toString('base64url');
	db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + SESSION_TTL);
	return { token, maxAge: SESSION_TTL / 1000 };
}

export function getSessionUser(token: string): User | null {
	const row = db
		.prepare('SELECT u.* , s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?')
		.get(token) as (UserRow & { expires_at: number }) | undefined;
	if (!row) return null;
	if (row.expires_at < Date.now()) {
		deleteSession(token);
		return null;
	}
	return toUser(row);
}

export function deleteSession(token: string) {
	db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ---------- projects & items ----------

export function listProjects() {
	return db
		.prepare(
			`SELECT p.*, (SELECT COUNT(*) FROM items i WHERE i.project_id = p.id AND i.parent_id IS NOT NULL) AS item_count
			 FROM projects p ORDER BY updated_at DESC`
		)
		.all() as (Project & { item_count: number })[];
}

export function getProject(id: string) {
	return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function createProject(name: string, userId: string) {
	const id = nanoid(10);
	const rootId = nanoid(12);
	const now = Date.now();
	db.prepare('INSERT INTO projects (id, name, root_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, rootId, now, now);
	db.prepare(
		`INSERT INTO items (id, project_id, parent_id, type, name, x, y, w, h, content, updated_at, updated_by)
		 VALUES (?, ?, NULL, 'canvas', ?, 0, 0, 0, 0, '', ?, ?)`
	).run(rootId, id, name, now, userId);
	return id;
}

export function renameProject(id: string, name: string) {
	db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id);
	db.prepare('UPDATE items SET name = ? WHERE id = (SELECT root_id FROM projects WHERE id = ?)').run(name, id);
}

export function deleteProject(id: string) {
	db.prepare('DELETE FROM items WHERE project_id = ?').run(id);
	db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function touchProject(id: string) {
	db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(Date.now(), id);
}

export function listItems(projectId: string) {
	return db.prepare('SELECT * FROM items WHERE project_id = ?').all(projectId) as Item[];
}

export function getItem(id: string) {
	return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item | undefined;
}

export function insertItem(item: Item) {
	db.prepare(
		`INSERT INTO items (id, project_id, parent_id, type, name, x, y, w, h, content, updated_at, updated_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(item.id, item.project_id, item.parent_id, item.type, item.name, item.x, item.y, item.w, item.h, item.content, item.updated_at, item.updated_by);
}

const EDITABLE = ['parent_id', 'name', 'x', 'y', 'w', 'h', 'content'] as const;
export type ItemPatch = Partial<Pick<Item, (typeof EDITABLE)[number]>> & { id: string };

export function updateItem(patch: ItemPatch, userId: string) {
	const sets: string[] = [];
	const vals: (string | number | null)[] = [];
	for (const k of EDITABLE) {
		if (k in patch) {
			sets.push(`${k} = ?`);
			vals.push(patch[k] as string | number | null);
		}
	}
	if (!sets.length) return getItem(patch.id);
	sets.push('updated_at = ?', 'updated_by = ?');
	vals.push(Date.now(), userId, patch.id);
	db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
	return getItem(patch.id);
}

/** Returns ids of the item and all its descendants. */
export function subtreeIds(projectId: string, rootIds: string[]) {
	const all = listItems(projectId);
	const byParent = new Map<string, Item[]>();
	for (const it of all) {
		if (!it.parent_id) continue;
		(byParent.get(it.parent_id) ?? byParent.set(it.parent_id, []).get(it.parent_id)!).push(it);
	}
	const out: string[] = [];
	const stack = [...rootIds];
	while (stack.length) {
		const id = stack.pop()!;
		out.push(id);
		for (const c of byParent.get(id) ?? []) stack.push(c.id);
	}
	return out;
}

export function deleteItems(ids: string[]) {
	const stmt = db.prepare('DELETE FROM items WHERE id = ?');
	for (const id of ids) stmt.run(id);
}
