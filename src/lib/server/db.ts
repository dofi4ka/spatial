import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { nanoid } from 'nanoid';
import type { Access, Item, Member, Project, ProjectSummary, User, Visibility } from '#lib/types.ts';

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
	const projectCols = (db.prepare('PRAGMA table_info(projects)').all() as { name: string }[]).map((c) => c.name);
	if (!projectCols.includes('export_token')) db.exec('ALTER TABLE projects ADD COLUMN export_token TEXT');
	if (!projectCols.includes('owner_id')) db.exec('ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL');
	if (!projectCols.includes('visibility')) db.exec("ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'");
	if (!projectCols.includes('description')) db.exec("ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT ''");
	const itemCols = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
	if (!itemCols.includes('rev')) db.exec('ALTER TABLE items ADD COLUMN rev INTEGER NOT NULL DEFAULT 0');
	if (!itemCols.includes('hidden')) db.exec('ALTER TABLE items ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
	db.exec(`
		CREATE TABLE IF NOT EXISTS project_members (
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			added_at INTEGER NOT NULL,
			PRIMARY KEY (project_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS members_user ON project_members(user_id);
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

export function getUser(id: string) {
	const r = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
	return r ? toUser(r) : null;
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

const SUMMARY = `
	SELECT p.id, p.name, p.description, p.root_id, p.owner_id, p.visibility, p.created_at, p.updated_at,
		u.name AS owner_name,
		(SELECT COUNT(*) FROM items i WHERE i.project_id = p.id AND i.parent_id IS NOT NULL) AS item_count,
		(SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id) AS member_count
	FROM projects p LEFT JOIN users u ON u.id = p.owner_id`;

/** Projects the user owns or was added to. */
export function listUserProjects(userId: string) {
	return db
		.prepare(`${SUMMARY} WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?) ORDER BY p.updated_at DESC`)
		.all(userId, userId) as ProjectSummary[];
}

/** Public projects of other people that the user isn't a member of. */
export function listPublicProjects(userId: string) {
	return db
		.prepare(
			`${SUMMARY} WHERE p.visibility = 'public' AND (p.owner_id IS NULL OR p.owner_id != ?)
			 AND p.id NOT IN (SELECT project_id FROM project_members WHERE user_id = ?) ORDER BY p.updated_at DESC`
		)
		.all(userId, userId) as ProjectSummary[];
}

/** Every project (admin overview). */
export function listAllProjects() {
	return db.prepare(`${SUMMARY} ORDER BY p.updated_at DESC`).all() as ProjectSummary[];
}

export function getProject(id: string) {
	return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

/** The project without server-only fields, safe to send to the browser. */
export function clientProject(p: Project): Project {
	const { export_token: _, ...rest } = p;
	return rest;
}

export function isMember(projectId: string, userId: string) {
	return !!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

/**
 * GitHub-like access: the owner and members can edit; public projects are visible to every
 * signed-in user; admins can view everything (to moderate) but only edit projects they belong to.
 */
export function projectAccess(p: Project, user: User | null): Access | null {
	if (!user) return null;
	if (p.owner_id === user.id) return 'owner';
	if (isMember(p.id, user.id)) return 'edit';
	if (p.visibility === 'public' || user.is_admin) return 'view';
	return null;
}

export const canEdit = (a: Access | null) => a === 'owner' || a === 'edit';

export function createProject(name: string, userId: string, description = '', visibility: Visibility = 'private') {
	const id = nanoid(10);
	const rootId = nanoid(12);
	const now = Date.now();
	db.prepare('INSERT INTO projects (id, name, description, root_id, owner_id, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
		id,
		name,
		description,
		rootId,
		userId,
		visibility,
		now,
		now
	);
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

export function setProjectDescription(id: string, description: string) {
	db.prepare('UPDATE projects SET description = ?, updated_at = ? WHERE id = ?').run(description, Date.now(), id);
}

export function setProjectVisibility(id: string, visibility: Visibility) {
	const prev = getProject(id);
	db.prepare('UPDATE projects SET visibility = ? WHERE id = ?').run(visibility, id);
	// people who could view the public project may have copied its export link
	if (prev?.visibility === 'public' && visibility === 'private') rotateExportToken(id);
}

export function deleteProject(id: string) {
	db.prepare('DELETE FROM items WHERE project_id = ?').run(id);
	db.prepare('DELETE FROM project_members WHERE project_id = ?').run(id);
	db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function listMembers(projectId: string) {
	return db
		.prepare('SELECT u.id, u.email, u.name, m.added_at FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY m.added_at')
		.all(projectId) as Member[];
}

export function addMember(projectId: string, userId: string) {
	db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, added_at) VALUES (?, ?, ?)').run(projectId, userId, Date.now());
}

export function removeMember(projectId: string, userId: string) {
	db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
}

/**
 * Projects from before ownership existed: the creator (who made the root canvas) becomes the
 * owner — or the env admin if unknown — and everyone else becomes a member, so nobody loses
 * the access they had.
 */
export function migrateOwnership() {
	const orphans = db.prepare('SELECT * FROM projects WHERE owner_id IS NULL').all() as Project[];
	if (!orphans.length) return;
	const users = db.prepare('SELECT id, email, is_admin FROM users ORDER BY created_at').all() as { id: string; email: string; is_admin: number }[];
	if (!users.length) return;
	const fallback = users.find((u) => isEnvAdmin(u.email)) ?? users.find((u) => u.is_admin) ?? users[0];
	for (const p of orphans) {
		const root = getItem(p.root_id);
		const owner = users.find((u) => u.id === root?.updated_by) ?? fallback;
		db.prepare('UPDATE projects SET owner_id = ? WHERE id = ?').run(owner.id, p.id);
		for (const u of users) if (u.id !== owner.id) addMember(p.id, u.id);
	}
	console.info(`[spatial] assigned owners to ${orphans.length} existing project(s); other users were added as members`);
}

/** Before deleting a user, hand their projects to someone so nothing is lost. */
export function transferProjects(fromUserId: string, toUserId: string) {
	db.prepare('UPDATE projects SET owner_id = ? WHERE owner_id = ?').run(toUserId, fromUserId);
	db.prepare('DELETE FROM project_members WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE owner_id = ?)').run(toUserId, toUserId);
}

export function countOwnedProjects(userId: string) {
	return (db.prepare('SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?').get(userId) as { n: number }).n;
}

/** Secret used by the curl-able export URLs; created on first use. */
export function exportToken(id: string) {
	const row = db.prepare('SELECT export_token FROM projects WHERE id = ?').get(id) as { export_token: string | null } | undefined;
	if (!row) return null;
	return row.export_token ?? rotateExportToken(id);
}

/** Replaces the export token, invalidating previously shared commands. */
export function rotateExportToken(id: string) {
	const token = randomBytes(24).toString('base64url');
	db.prepare('UPDATE projects SET export_token = ? WHERE id = ?').run(token, id);
	return token;
}

export function getProjectByExportToken(token: string) {
	if (!token || token.length < 20) return undefined;
	return db.prepare('SELECT * FROM projects WHERE export_token = ?').get(token) as Project | undefined;
}

export function touchProject(id: string) {
	db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(Date.now(), id);
}

type ItemRow = Omit<Item, 'hidden'> & { hidden: number };
const toItem = (r: ItemRow): Item => ({ ...r, hidden: !!r.hidden });

export function listItems(projectId: string) {
	return (db.prepare('SELECT * FROM items WHERE project_id = ?').all(projectId) as ItemRow[]).map(toItem);
}

export function getItem(id: string) {
	const r = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined;
	return r ? toItem(r) : undefined;
}

export function insertItem(item: Item) {
	db.prepare(
		`INSERT INTO items (id, project_id, parent_id, type, name, x, y, w, h, content, updated_at, updated_by, rev, hidden)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(item.id, item.project_id, item.parent_id, item.type, item.name, item.x, item.y, item.w, item.h, item.content, item.updated_at, item.updated_by, item.rev, item.hidden ? 1 : 0);
}

/**
 * Replaces the content if `baseRev` is still the current revision (the writer has seen every
 * earlier change); otherwise returns null and the writer must merge and retry.
 */
export function setContent(id: string, baseRev: number, content: string, userId: string) {
	const r = db
		.prepare('UPDATE items SET content = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE id = ? AND rev = ?')
		.run(content, Date.now(), userId, id, baseRev);
	return r.changes ? getItem(id)! : null;
}

/** Fields anyone may change without a revision check (last write wins). Content goes through setContent. */
const EDITABLE = ['parent_id', 'name', 'x', 'y', 'w', 'h', 'hidden'] as const;
export type ItemPatch = Partial<Pick<Item, (typeof EDITABLE)[number]>> & { id: string };

export function updateItem(patch: ItemPatch, userId: string) {
	const sets: string[] = [];
	const vals: (string | number | null)[] = [];
	for (const k of EDITABLE) {
		if (k in patch) {
			sets.push(`${k} = ?`);
			const v = patch[k];
			vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : (v as string | number | null));
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
