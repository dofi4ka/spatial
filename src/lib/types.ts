export type User = { id: string; email: string; name: string; is_admin: boolean };

export type ItemType = 'canvas' | 'markdown' | 'image' | 'page' | 'drawing' | 'notebook';

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
	/** markdown source, page JSON, Excalidraw scene JSON, notebook JSON, or uploaded image filename */
	content: string;
	updated_at: number;
	updated_by: string | null;
};

export type Visibility = 'private' | 'public';

export type Project = {
	id: string;
	name: string;
	description: string;
	root_id: string;
	owner_id: string | null;
	/** public = every signed-in user can view; only the owner and members can edit */
	visibility: Visibility;
	created_at: number;
	updated_at: number;
	/** secret for the token-authenticated export URLs (curl / tar); never sent to the browser */
	export_token?: string | null;
};

/** What the current user may do with a project. owner ⊃ edit ⊃ view. */
export type Access = 'owner' | 'edit' | 'view';

/** A project as listed on the projects pages. */
export type ProjectSummary = Omit<Project, 'export_token'> & { owner_name: string | null; item_count: number; member_count: number };

export type Member = { id: string; email: string; name: string; added_at: number };

export type Presence = { clientId: string; userId: string; name: string; color: string };

export type ServerEvent =
	| { t: 'upsert'; items: Item[]; origin?: string; by?: string }
	| { t: 'delete'; ids: string[]; origin?: string; by?: string }
	| { t: 'presence'; users: Presence[] }
	| { t: 'cursor'; clientId: string; canvas: string | null; x: number; y: number; file: string | null };
