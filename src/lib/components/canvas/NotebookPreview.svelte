<script lang="ts">
	import { firstImage, parseNotebook } from '#lib/notebook.ts';

	let { content }: { content: string } = $props();
	let nb = $derived(parseNotebook(content));
	let code = $derived(nb.cells.filter((c) => c.kind === 'code' && c.src.trim()).map((c) => c.src.trim()).join('\n\n').slice(0, 1500));
	let img = $derived(firstImage(nb));
</script>

<div class="flex h-full flex-col overflow-hidden bg-zinc-50">
	{#if !code}
		<div class="grid h-full place-items-center text-xs text-zinc-400">Empty notebook</div>
	{:else}
		<pre class="min-h-0 shrink overflow-hidden px-3 py-2 font-mono text-[10.5px] leading-snug text-zinc-700 {img ? 'max-h-[45%]' : 'flex-1'}">{code}</pre>
		{#if img}<img src={img} alt="" class="min-h-0 flex-1 border-t border-zinc-200 bg-white object-contain p-1" draggable="false" />{/if}
	{/if}
</div>
