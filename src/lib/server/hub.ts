import type { Presence, ServerEvent, User } from '#lib/types.ts';

type Client = Presence & { send: (data: string) => void };

const g = globalThis as unknown as { __spatial_hub?: Map<string, Map<string, Client>> };
const rooms = (g.__spatial_hub ??= new Map());

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
export function colorFor(id: string) {
	let h = 0;
	for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	return COLORS[h % COLORS.length];
}

export function broadcast(projectId: string, ev: ServerEvent, exceptClient?: string) {
	const room = rooms.get(projectId);
	if (!room) return;
	const data = `data: ${JSON.stringify(ev)}\n\n`;
	for (const c of room.values()) if (c.clientId !== exceptClient) c.send(data);
}

function presence(projectId: string) {
	const room = rooms.get(projectId);
	const users = room ? [...room.values()].map(({ clientId, userId, name, color }) => ({ clientId, userId, name, color })) : [];
	broadcast(projectId, { t: 'presence', users });
}

export function subscribe(projectId: string, clientId: string, user: User) {
	const encoder = new TextEncoder();
	let ping: ReturnType<typeof setInterval>;
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const room = rooms.get(projectId) ?? rooms.set(projectId, new Map()).get(projectId)!;
			const send = (s: string) => {
				try {
					controller.enqueue(encoder.encode(s));
				} catch {
					/* closed */
				}
			};
			room.set(clientId, { clientId, userId: user.id, name: user.name, color: colorFor(user.id), send });
			send('retry: 2000\n\n');
			ping = setInterval(() => send(': ping\n\n'), 20000);
			presence(projectId);
		},
		cancel() {
			clearInterval(ping);
			rooms.get(projectId)?.delete(clientId);
			presence(projectId);
		}
	});
	return stream;
}
