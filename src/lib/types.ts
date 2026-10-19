export type User = { id: string; email: string; name: string; is_admin: boolean };

export type ItemType = 'canvas' | 'markdown' | 'image' | 'page' | 'drawing';

export type Item = {
	id: string;
	project_id: string;
	parent_id: string | null;
	type: ItemType;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
	/** markdown source, page JSON, Excalidraw scene JSON, or uploaded image filename */
	content: string;
	updated_at: number;
	updated_by: string | null;
};

export type Project = {
	id: string;
	name: string;
	root_id: string;
	created_at: number;
	updated_at: number;
};

export type Presence = { clientId: string; userId: string; name: string; color: string };

export type ServerEvent =
	| { t: 'upsert'; items: Item[]; origin?: string; by?: string }
	| { t: 'delete'; ids: string[]; origin?: string; by?: string }
	| { t: 'presence'; users: Presence[] }
	| { t: 'cursor'; clientId: string; canvas: string | null; x: number; y: number; file: string | null };
