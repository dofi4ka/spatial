<script lang="ts">
	import { parsePage } from '#lib/page.ts';
	import PreviewNode from '../page/PreviewNode.svelte';

	let { content, width }: { content: string; width: number } = $props();
	const VW = 960;
	let root = $derived(parsePage(content));
	let scale = $derived(width / VW);
</script>

<div class="h-full w-full overflow-hidden bg-white">
	{#if root.children.length === 0 && !root.prompt}
		<div class="grid h-full place-items-center text-xs text-zinc-400">Empty page</div>
	{:else}
		<div style="width:{VW}px;transform:scale({scale});transform-origin:0 0;padding:12px;pointer-events:none">
			<PreviewNode node={root} />
		</div>
	{/if}
</div>
