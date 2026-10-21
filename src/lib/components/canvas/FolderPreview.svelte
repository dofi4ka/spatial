<script lang="ts">
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { icons } from '#lib/icons.ts';
	import { visualSrc } from '#lib/drawing.ts';

	let { store, id, width, height }: { store: ProjectStore; id: string; width: number; height: number } = $props();

	let kids = $derived(store.children(id));
	let view = $derived.by(() => {
		if (!kids.length) return null;
		let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		for (const k of kids) {
			x0 = Math.min(x0, k.x); y0 = Math.min(y0, k.y);
			x1 = Math.max(x1, k.x + k.w); y1 = Math.max(y1, k.y + k.h);
		}
		const pad = 16;
		const s = Math.min((width - pad * 2) / (x1 - x0), (height - pad * 2) / (y1 - y0), 0.5);
		const ox = (width - (x1 - x0) * s) / 2 - x0 * s;
		const oy = (height - (y1 - y0) * s) / 2 - y0 * s;
		return { s, ox, oy };
	});
	const tint: Record<string, string> = { canvas: '#eef2ff', markdown: '#fff', page: '#fff', image: '#f4f4f5', drawing: '#fff', notebook: '#fafafa' };
</script>

<div class="relative h-full w-full overflow-hidden bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:10px_10px]">
	{#if !view}
		<div class="grid h-full place-items-center text-xs text-zinc-400">Empty canvas</div>
	{:else}
		{#each kids as k (k.id)}
			<div
				class="absolute overflow-hidden rounded-[3px] border border-zinc-300 shadow-sm"
				style="left:{view.ox + k.x * view.s}px;top:{view.oy + k.y * view.s}px;width:{k.w * view.s}px;height:{k.h * view.s}px;background:{tint[k.type]}"
			>
				{#if visualSrc(k)}
					<img src={visualSrc(k)} alt="" class="h-full w-full {k.type === 'image' ? 'object-cover' : 'object-contain'}" loading="lazy" draggable="false" />
				{:else if k.w * view.s > 40}
					<div class="flex items-center gap-1 p-1 text-[9px] leading-tight text-zinc-500">
						<span class="shrink-0">{@html icons[k.type]}</span><span class="truncate">{k.name}</span>
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>
