<script lang="ts">
	import type { Item } from '#lib/types.ts';
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { icons } from '#lib/icons.ts';
	import { renderMarkdown } from '#lib/markdown.ts';
	import PagePreview from './PagePreview.svelte';
	import FolderPreview from './FolderPreview.svelte';

	let {
		store,
		item,
		selected,
		dropTarget,
		zoom,
		lod,
		renaming,
		onrename
	}: {
		store: ProjectStore;
		item: Item;
		selected: boolean;
		dropTarget: boolean;
		zoom: number;
		lod: boolean;
		renaming: boolean;
		onrename: (name: string | null) => void;
	} = $props();

	const accent: Record<string, string> = { canvas: 'text-indigo-500', markdown: 'text-sky-500', image: 'text-emerald-500', page: 'text-amber-500' };
	let labelScale = $derived(Math.min(4, 1 / zoom));
</script>

<div
	data-item={item.id}
	class="absolute select-none"
	style="left:{item.x}px;top:{item.y}px;width:{item.w}px;height:{item.h}px"
>
	<!-- label above the card, constant on-screen size -->
	<div
		data-label={item.id}
		class="absolute bottom-full left-0 flex max-w-full origin-bottom-left items-center gap-1 pb-1 text-[12px] font-medium whitespace-nowrap text-zinc-600"
		style="transform:scale({labelScale});width:{item.w / labelScale}px"
	>
		<span class="{accent[item.type]} shrink-0 text-[13px]">{@html icons[item.type]}</span>
		{#if renaming}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="min-w-0 flex-1 rounded border border-indigo-400 bg-white px-1 text-[12px] outline-none"
				value={item.name}
				autofocus
				onfocus={(e) => e.currentTarget.select()}
				onpointerdown={(e) => e.stopPropagation()}
				onkeydown={(e) => {
					e.stopPropagation();
					if (e.key === 'Enter') onrename(e.currentTarget.value);
					if (e.key === 'Escape') onrename(null);
				}}
				onblur={(e) => onrename(e.currentTarget.value)}
			/>
		{:else}
			<span class="truncate">{item.name}</span>
		{/if}
	</div>

	<div
		class="h-full w-full overflow-hidden rounded-lg border bg-white shadow-sm transition-[box-shadow,border-color] {item.type === 'canvas' ? 'border-indigo-200' : 'border-zinc-200'}"
		class:ring-selected={selected}
		class:ring-drop={dropTarget}
	>
		{#if lod}
			<div class="grid h-full w-full place-items-center {accent[item.type]} opacity-40" style="font-size:{Math.min(item.w, item.h) / 3}px">{@html icons[item.type]}</div>
		{:else if item.type === 'markdown'}
			{#if item.content.trim()}
				<div class="md pointer-events-none h-full overflow-hidden p-4 text-[12px]">{@html renderMarkdown(item.content.slice(0, 4000), store.items)}</div>
			{:else}
				<div class="grid h-full place-items-center text-xs text-zinc-400">Empty document</div>
			{/if}
		{:else if item.type === 'image'}
			{#if item.content}
				<img src="/uploads/{item.content}" alt={item.name} class="h-full w-full object-contain" draggable="false" loading="lazy" />
			{:else}
				<div class="grid h-full place-items-center text-xs text-zinc-400">No image</div>
			{/if}
		{:else if item.type === 'page'}
			<PagePreview content={item.content} width={item.w} />
		{:else}
			<FolderPreview {store} id={item.id} width={item.w} height={item.h} />
		{/if}
	</div>

	{#if selected}
		<div
			data-resize={item.id}
			class="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border-2 border-indigo-500 bg-white"
			style="transform:scale({labelScale});transform-origin:center"
		></div>
	{/if}
</div>

<style>
	.ring-selected { border-color: #6366f1; box-shadow: 0 0 0 1px #6366f1, 0 4px 16px rgba(99, 102, 241, 0.15); }
	.ring-drop { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.5); }
</style>
