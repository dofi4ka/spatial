<script lang="ts">
	import { onMount } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { icons } from '#lib/icons.ts';

	let {
		store,
		x,
		y,
		exclude,
		onpick,
		onclose
	}: { store: ProjectStore; x: number; y: number; exclude?: string; onpick: (item: Item) => void; onclose: () => void } = $props();

	let q = $state('');
	let active = $state(0);
	let list: HTMLDivElement;
	let input: HTMLInputElement;

	onMount(() => input?.focus());

	const order = { image: 0, markdown: 1, page: 2, canvas: 3 };
	let results = $derived.by(() => {
		const s = q.trim().toLowerCase();
		return Object.values(store.items)
			.filter((i) => i.parent_id && i.id !== exclude && (!s || i.name.toLowerCase().includes(s)))
			.map((i) => ({ item: i, where: store.path(i.parent_id!).slice(1).map((c) => c.name).join(' / ') }))
			.sort((a, b) => {
				const sa = s && a.item.name.toLowerCase().startsWith(s) ? 0 : 1;
				const sb = s && b.item.name.toLowerCase().startsWith(s) ? 0 : 1;
				return sa - sb || order[a.item.type] - order[b.item.type] || a.item.name.localeCompare(b.item.name);
			})
			.slice(0, 50);
	});

	$effect(() => {
		q;
		active = 0;
	});
	$effect(() => {
		list?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	function onKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'ArrowDown') (e.preventDefault(), (active = Math.min(active + 1, results.length - 1)));
		else if (e.key === 'ArrowUp') (e.preventDefault(), (active = Math.max(active - 1, 0)));
		else if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			if (results[active]) onpick(results[active].item);
		} else if (e.key === 'Escape') (e.preventDefault(), onclose());
	}

	const accent: Record<string, string> = { canvas: 'text-indigo-500', markdown: 'text-sky-500', image: 'text-emerald-500', page: 'text-amber-500' };
</script>

<div class="fixed inset-0 z-50" role="presentation" onpointerdown={onclose}></div>
<div
	class="fixed z-50 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
	style="left:{Math.min(x, (typeof window === 'undefined' ? 1e4 : window.innerWidth) - 330)}px;top:{Math.min(y, (typeof window === 'undefined' ? 1e4 : window.innerHeight) - 340)}px"
>
	<div class="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
		<span class="font-semibold text-indigo-500">@</span>
		<input bind:this={input} bind:value={q} onkeydown={onKey} placeholder="Mention a file…" class="w-full text-sm outline-none" />
	</div>
	<div bind:this={list} class="max-h-72 overflow-y-auto p-1">
		{#each results as r, i (r.item.id)}
			<button
				data-i={i}
				class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm {i === active ? 'bg-indigo-50' : 'hover:bg-zinc-50'}"
				onmouseenter={() => (active = i)}
				onclick={() => onpick(r.item)}
			>
				{#if r.item.type === 'image' && r.item.content}
					<img src="/uploads/{r.item.content}" alt="" class="h-6 w-6 shrink-0 rounded object-cover" />
				{:else}
					<span class="grid h-6 w-6 shrink-0 place-items-center {accent[r.item.type]}">{@html icons[r.item.type]}</span>
				{/if}
				<span class="min-w-0 flex-1">
					<span class="block truncate">{r.item.name}</span>
					{#if r.where}<span class="block truncate text-[11px] text-zinc-400">{r.where}</span>{/if}
				</span>
			</button>
		{:else}
			<div class="p-4 text-center text-sm text-zinc-400">No files match</div>
		{/each}
	</div>
</div>
