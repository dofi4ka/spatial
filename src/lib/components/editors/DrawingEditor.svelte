<script lang="ts">
	import { onMount } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { parseDrawing, type DrawingData } from '#lib/drawing.ts';

	let { store, item }: { store: ProjectStore; item: Item } = $props();

	let el: HTMLDivElement;
	let loading = $state(true);
	let failed = $state<string | null>(null);

	// svelte-ignore state_referenced_locally
	const id = item.id;
	let current: DrawingData = parseDrawing(item.content);
	let lastLocal = item.content;
	let lastEdit = 0;
	let sceneKey = '';
	let dirtyRender = false;
	let saveTimer: ReturnType<typeof setTimeout>;
	let renderTimer: ReturnType<typeof setTimeout>;
	let applyRemote: ((d: DrawingData) => void) | null = null;
	let renderNow: (() => Promise<void>) | null = null;

	function save() {
		clearTimeout(saveTimer);
		const json = JSON.stringify(current);
		if (json === lastLocal) return;
		lastLocal = json;
		store.update(id, { content: json });
	}

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
				save();
			};

			const initial = current;
			sceneKey = keyOf(initial.elements, initial.appState.viewBackgroundColor, Object.keys(initial.files).length);
			let api: import('@excalidraw/excalidraw/types').ExcalidrawImperativeAPI | null = null;

			applyRemote = (d) => {
				if (!api) return;
				current = d;
				if (Object.keys(d.files).length) api.addFiles(Object.values(d.files) as never);
				api.updateScene({ elements: d.elements as never, appState: { viewBackgroundColor: d.appState.viewBackgroundColor ?? '#ffffff' } as never });
				sceneKey = keyOf(d.elements, d.appState.viewBackgroundColor, Object.keys(d.files).length);
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
					excalidrawAPI: (a) => (api = a),
					UIOptions: { canvasActions: { loadScene: false, saveToActiveFile: false } },
					onChange: (els, appState, files) => {
						const key = keyOf(els, appState.viewBackgroundColor, Object.keys(files).length);
						if (key === sceneKey) return;
						sceneKey = key;
						current = { ...current, ...snapshot(els, appState.viewBackgroundColor, files) };
						lastEdit = Date.now();
						dirtyRender = true;
						clearTimeout(saveTimer);
						saveTimer = setTimeout(save, 500);
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
			save();
			// keep the PNG in sync even if the editor closes right after an edit
			if (dirtyRender) renderNow?.();
			else clearTimeout(renderTimer);
			root?.unmount();
		};
	});

	// pull in edits made by others when we're idle
	let retry: ReturnType<typeof setTimeout>;
	$effect(() => {
		const r = store.remote;
		if (!r || r.id !== id) return;
		const apply = () => {
			const c = store.items[id]?.content;
			if (c === undefined || c === lastLocal || !applyRemote) return;
			if (Date.now() - lastEdit < 1500) return void (retry = setTimeout(apply, 800));
			lastLocal = c;
			applyRemote(parseDrawing(c));
		};
		clearTimeout(retry);
		apply();
	});
</script>

<div class="relative h-full w-full">
	{#if loading && !failed}<div class="absolute inset-0 grid place-items-center text-sm text-zinc-400">Loading Excalidraw…</div>{/if}
	{#if failed}<div class="absolute inset-0 grid place-items-center text-sm text-red-600">Could not load the drawing editor: {failed}</div>{/if}
	<div bind:this={el} class="h-full w-full"></div>
</div>
