<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page, updated } from '$app/state';
	import type { Access, Item, Project, User } from '#lib/types.ts';
	import { ProjectStore } from '#lib/store.svelte.ts';
	import { icons } from '#lib/icons.ts';
	import Canvas from './canvas/Canvas.svelte';
	import MarkdownEditor from './editors/MarkdownEditor.svelte';
	import ImageEditor from './editors/ImageEditor.svelte';
	import PageEditor from './editors/PageEditor.svelte';
	import DrawingEditor from './editors/DrawingEditor.svelte';
	import NotebookEditor from './editors/NotebookEditor.svelte';

	let { project, items, user, access }: { project: Project; items: Item[]; user: User; access: Access } = $props();

	// svelte-ignore state_referenced_locally
	const store = new ProjectStore(project, items, access === 'view');
	const readonly = store.readonly;
	setContext('spatial:items', store.items);
	onMount(() => {
		const disconnect = store.connect();
		const flush = () => store.flush();
		window.addEventListener('pagehide', flush);
		return () => {
			flush();
			disconnect();
			window.removeEventListener('pagehide', flush);
		};
	});

	// A new version was deployed: an old page would sync with an outdated protocol, so save what's
	// pending and reload to pick up the new code.
	$effect(() => {
		if (!updated.current) return;
		store.flush().finally(() => location.reload());
	});

	let canvasId = $derived.by(() => {
		const c = page.url.searchParams.get('c');
		return c && store.items[c]?.type === 'canvas' ? c : store.rootId;
	});
	let file = $derived.by(() => {
		const f = page.url.searchParams.get('f');
		const it = f ? store.items[f] : undefined;
		return it && it.type !== 'canvas' ? it : null;
	});
	let crumbs = $derived(store.path(canvasId));
	let viewers = $derived.by(() => {
		const seen = new Map<string, (typeof store.presence)[number]>();
		for (const p of store.presence) if (!seen.has(p.userId)) seen.set(p.userId, p);
		return [...seen.values()];
	});
	let fileViewers = $derived(
		file
			? Object.entries(store.cursors)
					.filter(([id, c]) => c.file === file!.id && Date.now() - c.t < 30000)
					.map(([id]) => store.presence.find((p) => p.clientId === id))
					.filter((p) => p && p.userId !== user.id)
			: []
	);

	function nav(c: string | null, f: string | null) {
		const u = new URL(page.url.href);
		if (c && c !== store.rootId) u.searchParams.set('c', c);
		else u.searchParams.delete('c');
		if (f) u.searchParams.set('f', f);
		else u.searchParams.delete('f');
		goto(u.pathname + u.search, { reset: false });
	}

	function open(it: Item) {
		if (it.type === 'canvas') nav(it.id, null);
		else nav(canvasId, it.id);
	}

	// announce which file we're looking at so others can see it
	$effect(() => {
		const f = file?.id ?? null;
		if (f) {
			store.sendCursor(canvasId, f, 0, 0);
			const t = setInterval(() => store.sendCursor(canvasId, f, 0, 0), 10000);
			return () => clearInterval(t);
		}
	});

	let renamingFile = $state(false);
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const r = store.remote;
		if (r && file && r.id === file.id) {
			toast = `${r.by} edited this file`;
			clearTimeout(toastTimer);
			toastTimer = setTimeout(() => (toast = null), 2500);
		}
	});

	const typeLabel = { markdown: 'Markdown', image: 'Image', page: 'Page', canvas: 'Canvas', drawing: 'Drawing', notebook: 'Notebook' };
</script>

<svelte:head><title>{file ? `${file.name} · ` : ''}{project.name} · Spatial</title></svelte:head>

<div class="flex h-screen flex-col">
	<header class="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3">
		<a href="/" class="icon-btn" title="All projects"><span class="logo"></span></a>
		<nav class="flex min-w-0 items-center gap-0.5 text-sm">
			{#each crumbs as c, i (c.id)}
				{#if i > 0}<span class="text-zinc-300">/</span>{/if}
				<button
					data-drop-canvas={c.id}
					class="max-w-48 truncate rounded-md px-2 py-1 transition hover:bg-zinc-100 {i === crumbs.length - 1 && !file ? 'font-semibold text-zinc-900' : 'text-zinc-500'}"
					onclick={() => nav(c.id, null)}
				>{i === 0 ? project.name : c.name}</button>
			{/each}
			{#if file}
				<span class="text-zinc-300">/</span>
				{#if renamingFile}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="field-sm w-56"
						value={file.name}
						autofocus
						onblur={(e) => { const v = e.currentTarget.value.trim(); if (v && file) store.update(file.id, { name: v }); renamingFile = false; }}
						onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') renamingFile = false; }}
					/>
				{:else}
					<button class="flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold hover:bg-zinc-100" title={readonly ? file.name : 'Rename'} disabled={readonly} onclick={() => (renamingFile = true)}>
						<span class="text-zinc-400">{@html icons[file.type]}</span>{file.name}
					</button>
				{/if}
				<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{typeLabel[file.type]}</span>
			{/if}
		</nav>
		<div class="flex-1"></div>

		{#if readonly}
			<span class="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600" title="You can view this project. Ask the owner to add you to edit it.">{@html icons.eye} View only</span>
		{/if}
		{#if toast}<span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">{toast}</span>{/if}
		{#if fileViewers.length}
			<span class="text-xs text-zinc-500">also here:</span>
			{#each fileViewers as v}<span class="h-2 w-2 rounded-full" style="background:{v!.color}" title={v!.name}></span>{/each}
		{/if}

		<div class="flex items-center">
			{#each viewers.slice(0, 6) as p (p.userId)}
				<div class="-ml-1.5 grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white first:ml-0" style="background:{p.color}" title="{p.name}{p.userId === user.id ? ' (you)' : ''}">
					{p.name.slice(0, 2).toUpperCase()}
				</div>
			{/each}
			{#if viewers.length > 6}<span class="ml-1 text-xs text-zinc-500">+{viewers.length - 6}</span>{/if}
		</div>
		<span class="h-2 w-2 rounded-full {store.connected ? 'bg-emerald-500' : 'bg-zinc-300'}" title={store.connected ? 'Live' : 'Reconnecting…'}></span>
		{#if !readonly}<a class="icon-btn" href="/p/{project.id}/settings" title="Project settings and people">{@html icons.settings}</a>{/if}
		<a class="btn" href="/p/{project.id}/export" title="Export the project to your repository or as a .zip">{@html icons.download} Export</a>
		{#if file}
			<button class="icon-btn" title="Close (back to canvas)" onclick={() => nav(canvasId, null)}>{@html icons.close}</button>
		{/if}
	</header>

	<div class="relative min-h-0 flex-1">
		<Canvas {store} {canvasId} active={!file} {readonly} onopen={open} />
		{#if file}
			{#key file.id}
				<div class="absolute inset-0 z-20 bg-white">
					{#if file.type === 'markdown'}<MarkdownEditor {store} item={file} onopen={open} />
					{:else if file.type === 'image'}<ImageEditor {store} item={file} />
					{:else if file.type === 'drawing'}<DrawingEditor {store} item={file} />
					{:else if file.type === 'page'}<PageEditor {store} item={file} onopen={open} />
					{:else if file.type === 'notebook'}<NotebookEditor {store} item={file} />{/if}
				</div>
			{/key}
		{/if}
	</div>
</div>
