<script lang="ts">
	import { onMount } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import type { Binding, ProjectStore } from '#lib/store.svelte.ts';
	import { parseDrawing, type DrawingData } from '#lib/drawing.ts';

	let { store, item }: { store: ProjectStore; item: Item } = $props();

	let el: HTMLDivElement;
	let loading = $state(true);
	let failed = $state<string | null>(null);

	// svelte-ignore state_referenced_locally
	const id = item.id;
	// svelte-ignore state_referenced_locally
	const initialContent = item.content;
	let current: DrawingData = parseDrawing(initialContent);
	let sceneKey = '';
	let dirtyRender = false;
	let renderTimer: ReturnType<typeof setTimeout>;
	let renderNow: (() => Promise<void>) | null = null;
	// svelte-ignore state_referenced_locally
	const sync = store.sync(id);
	let binding: Binding | null = null;
	const save = () => sync.changed(JSON.stringify(current));

	onMount(() => {
		let root: import('react-dom/client').Root | null = null;
		let destroyed = false;

		(async () => {
			// serve fonts ourselves instead of from Excalidraw's CDN
			(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';
			const [React, { createRoot }, ex] = await Promise.all([
				import('react'),
				import('react-dom/client'),
				import('@excalidraw/excalidraw'),
				import('@excalidraw/excalidraw/index.css')
			]);
			if (destroyed) return;

			type El = { isDeleted?: boolean; fileId?: string | null };
			const keyOf = (els: readonly unknown[], bg?: string, fileCount = 0) => `${ex.getSceneVersion(els as never)}|${bg}|${fileCount}`;

			/** Snapshot of the scene that is worth saving: live elements and the files they use. */
			const snapshot = (els: readonly unknown[], bg: string | undefined, files: Record<string, unknown>) => {
				const live = (els as El[]).filter((e) => !e.isDeleted);
				const used: Record<string, unknown> = {};
				for (const e of live) if (e.fileId && files[e.fileId]) used[e.fileId] = files[e.fileId];
				return { elements: live, appState: { viewBackgroundColor: bg }, files: used };
			};

			renderNow = async () => {
				clearTimeout(renderTimer);
				dirtyRender = false;
				const scene = current;
				let png: string | null = null;
				let pngAt = Date.now();
				if (scene.elements.length) {
					const blob = await ex.exportToBlob({
						elements: scene.elements as never,
						appState: { viewBackgroundColor: scene.appState.viewBackgroundColor ?? '#ffffff', exportBackground: true, exportScale: 2 } as never,
						files: scene.files as never,
						mimeType: 'image/png',
						exportPadding: 24
					});
					const r = await fetch(`/api/projects/${store.project.id}/items/${id}/render`, {
						method: 'POST',
						headers: { 'content-type': 'image/png' },
						body: blob
					});
					if (!r.ok) return;
					({ file: png, at: pngAt } = await r.json());
				}
				// the scene may have changed while rendering; only the png fields are ours to set
				current = { ...current, png, pngAt };
				if (binding && sync.binding === binding) save();
				else if (store.items[id]) sync.changed(JSON.stringify({ ...parseDrawing(store.items[id].content), png, pngAt }));
			};

			const initial = current;
			sceneKey = keyOf(initial.elements, initial.appState.viewBackgroundColor, Object.keys(initial.files).length);
			let api: import('@excalidraw/excalidraw/types').ExcalidrawImperativeAPI | null = null;

			binding = {
				read: () => JSON.stringify(current),
				write: (json) => {
					const d = parseDrawing(json);
					current = d;
					if (!api) return;
					if (Object.keys(d.files).length) api.addFiles(Object.values(d.files) as never);
					// Keep Excalidraw's own objects for elements that are up to date or being drawn,
					// dragged, resized or typed into right now; swapping those for copies would break
					// the gesture in progress.
					type Ex = { id: string; version: number; versionNonce: number };
					const st = api.getAppState();
					const busy = new Set(
						[st.newElement, st.resizingElement, st.editingTextElement, st.multiElement, st.editingLinearElement?.elementId]
							.map((e) => (typeof e === 'string' ? e : e?.id))
							.concat(st.selectedElementsAreBeingDragged ? Object.keys(st.selectedElementIds) : [])
							.filter(Boolean) as string[]
					);
					const local = new Map((api.getSceneElements() as unknown as Ex[]).map((e) => [e.id, e]));
					const elements = (d.elements as Ex[]).map((r) => {
						const l = local.get(r.id);
						return l && (busy.has(r.id) || l.version > r.version || (l.version === r.version && l.versionNonce === r.versionNonce)) ? l : r;
					});
					for (const id of busy) if (local.has(id) && !elements.some((e) => e.id === id)) elements.push(local.get(id)!);
					// not undoable: undo should only revert our own strokes
					api.updateScene({
						elements: elements as never,
						appState: { viewBackgroundColor: d.appState.viewBackgroundColor ?? '#ffffff' } as never,
						captureUpdate: ex.CaptureUpdateAction.NEVER
					});
					sceneKey = keyOf(d.elements, d.appState.viewBackgroundColor, Object.keys(d.files).length);
				}
			};

			root = createRoot(el);
			root.render(
				React.createElement(ex.Excalidraw, {
					initialData: {
						elements: initial.elements as never,
						appState: { viewBackgroundColor: initial.appState.viewBackgroundColor ?? '#ffffff' },
						files: initial.files as never,
						scrollToContent: true
					},
					excalidrawAPI: (a) => {
						api = a;
						// after Excalidraw has mounted, so it can take a scene update
						setTimeout(() => !destroyed && binding && sync.attach(binding, initialContent));
					},
					viewModeEnabled: store.readonly,
					UIOptions: { canvasActions: { loadScene: false, saveToActiveFile: false } },
					onChange: (els, appState, files) => {
						const key = keyOf(els, appState.viewBackgroundColor, Object.keys(files).length);
						if (key === sceneKey) return;
						sceneKey = key;
						current = { ...current, ...snapshot(els, appState.viewBackgroundColor, files) };
						dirtyRender = true;
						save();
						clearTimeout(renderTimer);
						renderTimer = setTimeout(() => renderNow?.(), 1500);
					}
				})
			);
			loading = false;
		})().catch((e) => {
			console.error(e);
			failed = (e as Error).message;
		});

		return () => {
			destroyed = true;
			if (binding) sync.detach(binding);
			// keep the PNG in sync even if the editor closes right after an edit
			if (dirtyRender) renderNow?.();
			else clearTimeout(renderTimer);
			root?.unmount();
		};
	});
</script>

<div class="relative h-full w-full">
	{#if loading && !failed}<div class="absolute inset-0 grid place-items-center text-sm text-zinc-400">Loading Excalidraw…</div>{/if}
	{#if failed}<div class="absolute inset-0 grid place-items-center text-sm text-red-600">Could not load the drawing editor: {failed}</div>{/if}
	<div bind:this={el} class="h-full w-full"></div>
</div>
