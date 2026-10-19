<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { countNodes, findParent, pageToHtml } from '#lib/page.ts';
	import { icons } from '#lib/icons.ts';
	import { planExport, resolverFor } from '#lib/mentions.ts';
	import { PageEditorState } from '../page/editor.svelte';
	import NodeView from '../page/NodeView.svelte';
	import ComponentLibrary from '../page/ComponentLibrary.svelte';
	import Inspector from '../page/Inspector.svelte';
	import Layers from '../page/Layers.svelte';

	let { store, item, onopen }: { store: ProjectStore; item: Item; onopen?: (item: Item) => void } = $props();

	let lastLocal = item.content;
	let lastEdit = 0;
	let saveTimer: ReturnType<typeof setTimeout>;

	const ed = new PageEditorState(item.content, (json) => {
		lastLocal = json;
		lastEdit = Date.now();
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => store.update(item.id, { content: json }), 350);
	});
	ed.selectedId = ed.root.id;

	onDestroy(() => {
		clearTimeout(saveTimer);
		if (lastLocal !== store.items[item.id]?.content) store.update(item.id, { content: lastLocal });
	});

	// remote edits replace the tree when we're idle
	let retry: ReturnType<typeof setTimeout>;
	$effect(() => {
		const r = store.remote;
		if (!r || r.id !== item.id) return;
		const apply = () => {
			const c = store.items[item.id]?.content;
			if (c === undefined || c === lastLocal) return;
			if (Date.now() - lastEdit < 1500) return void (retry = setTimeout(apply, 800));
			lastLocal = c;
			ed.replace(c);
		};
		clearTimeout(retry);
		apply();
	});

	let leftTab = $state<'components' | 'layers'>('components');
	let rightTab = $state<'inspect' | 'html'>('inspect');
	let width = $state<'full' | 768 | 390>('full');
	let html = $derived(rightTab === 'html' ? pageToHtml(ed.root, item.name, resolverFor(planExport(Object.values(store.items), store.rootId), item.id)) : '');
	let copied = $state(false);

	function isTyping(e: Event) {
		const t = e.target as HTMLElement;
		return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
	}

	function onKey(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key === 'z' && !isTyping(e)) {
			e.preventDefault();
			return e.shiftKey ? ed.redo() : ed.undo();
		}
		if (mod && e.key === 'y' && !isTyping(e)) return (e.preventDefault(), ed.redo());
		if (isTyping(e)) {
			if (e.key === 'Escape') (e.target as HTMLElement).blur();
			return;
		}
		const id = ed.selectedId;
		if (!id) return;
		const notRoot = id !== ed.root.id;
		if ((e.key === 'Delete' || e.key === 'Backspace') && notRoot) (e.preventDefault(), ed.remove(id));
		else if (mod && e.key === 'd' && notRoot) (e.preventDefault(), ed.duplicate(id));
		else if (mod && e.key === 'g' && notRoot) (e.preventDefault(), e.shiftKey ? ed.unwrap(id) : ed.wrap(id));
		else if (mod && e.key === 'c' && notRoot) ed.copy(id);
		else if (mod && e.key === 'x' && notRoot) (ed.copy(id), ed.remove(id));
		else if (mod && e.key === 'v') (e.preventDefault(), ed.paste());
		else if (e.key === 'Escape') ed.selectedId = findParent(ed.root, id)?.id ?? ed.root.id;
		else if (e.altKey && e.key === 'ArrowUp') (e.preventDefault(), ed.shift(id, -1));
		else if (e.altKey && e.key === 'ArrowDown') (e.preventDefault(), ed.shift(id, 1));
		else if (e.key === 'Enter') (e.preventDefault(), ed.focusPrompt++);
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="flex h-full min-h-0">
	<!-- left: components / layers -->
	<aside class="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
		<div class="flex gap-1 border-b border-zinc-100 p-1.5">
			<button class="btn-ghost flex-1 text-xs {leftTab === 'components' ? 'bg-zinc-100 text-zinc-900' : ''}" onclick={() => (leftTab = 'components')}>{@html icons.grid} Components</button>
			<button class="btn-ghost flex-1 text-xs {leftTab === 'layers' ? 'bg-zinc-100 text-zinc-900' : ''}" onclick={() => (leftTab = 'layers')}>{@html icons.layers} Layers <span class="text-zinc-400">{countNodes(ed.root) - 1}</span></button>
		</div>
		<div class="min-h-0 flex-1">
			{#if leftTab === 'components'}<ComponentLibrary {ed} />{:else}<Layers {ed} />{/if}
		</div>
	</aside>

	<!-- center: page -->
	<div class="flex min-w-0 flex-1 flex-col bg-zinc-100">
		<div class="flex items-center gap-1 border-b border-zinc-200 bg-white px-2 py-1">
			<button class="icon-btn" title="Undo (⌘Z)" disabled={!ed.canUndo} class:opacity-30={!ed.canUndo} onclick={() => ed.undo()}>{@html icons.undo}</button>
			<button class="icon-btn" title="Redo (⇧⌘Z)" disabled={!ed.canRedo} class:opacity-30={!ed.canRedo} onclick={() => ed.redo()}>{@html icons.redo}</button>
			<div class="mx-2 h-5 w-px bg-zinc-200"></div>
			<button class="icon-btn {width === 'full' ? 'bg-zinc-100 text-zinc-900' : ''}" title="Desktop" onclick={() => (width = 'full')}>{@html icons.desktop}</button>
			<button class="icon-btn {width === 768 ? 'bg-zinc-100 text-zinc-900' : ''}" title="Tablet · 768px" onclick={() => (width = 768)}>{@html icons.tablet}</button>
			<button class="icon-btn {width === 390 ? 'bg-zinc-100 text-zinc-900' : ''}" title="Mobile · 390px" onclick={() => (width = 390)}>{@html icons.mobile}</button>
			<div class="flex-1"></div>
			<span class="hidden text-[11px] text-zinc-400 lg:inline">
				Drag to place · <span class="kbd">⌫</span> delete · <span class="kbd">⌘D</span> duplicate · <span class="kbd">⌘G</span> wrap · <span class="kbd">Esc</span> parent
			</span>
		</div>
		<div
			class="min-h-0 flex-1 overflow-auto p-6"
			role="presentation"
			onclick={() => (ed.selectedId = ed.root.id)}
		>
			<div class="mx-auto min-h-full rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 transition-[max-width]" style="max-width:{width === 'full' ? '100%' : width + 'px'}">
				<NodeView {ed} node={ed.root} isRoot />
			</div>
		</div>
	</div>

	<!-- right: inspector / html -->
	<aside class="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white">
		<div class="flex gap-1 border-b border-zinc-100 p-1.5">
			<button class="btn-ghost flex-1 text-xs {rightTab === 'inspect' ? 'bg-zinc-100 text-zinc-900' : ''}" onclick={() => (rightTab = 'inspect')}>Inspect</button>
			<button class="btn-ghost flex-1 text-xs {rightTab === 'html' ? 'bg-zinc-100 text-zinc-900' : ''}" onclick={() => (rightTab = 'html')}>{@html icons.code} HTML</button>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if rightTab === 'inspect'}
				<Inspector {ed} {store} pageId={item.id} {onopen} />
			{:else}
				<div class="flex h-full flex-col">
					<div class="flex justify-end p-2">
						<button class="btn text-xs" onclick={async () => { await navigator.clipboard.writeText(html); copied = true; setTimeout(() => (copied = false), 1500); }}>{@html icons.copy} {copied ? 'Copied' : 'Copy HTML'}</button>
					</div>
					<pre class="min-h-0 flex-1 overflow-auto bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed whitespace-pre text-zinc-200">{html}</pre>
				</div>
			{/if}
		</div>
	</aside>
</div>
