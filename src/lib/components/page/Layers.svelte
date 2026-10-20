<script lang="ts">
	import type { PageNode } from '#lib/page.ts';
	import type { PageEditorState } from './editor.svelte';

	let { ed }: { ed: PageEditorState } = $props();
	let closed = $state<Record<string, boolean>>({});
	const dirIcon = { none: '·', col: '↓', row: '→', grid: '▦' };
</script>

{#snippet item(n: PageNode, depth: number)}
	<div
		class="group flex cursor-pointer items-center gap-1 rounded-md py-0.5 pr-2 text-xs {ed.selectedId === n.id ? 'bg-indigo-100 text-indigo-900' : ed.hoverId === n.id ? 'bg-zinc-100' : 'hover:bg-zinc-50'}"
		style="padding-left:{depth * 12 + 4}px"
		role="treeitem"
		aria-selected={ed.selectedId === n.id}
		tabindex="-1"
		onclick={() => (ed.selectedId = n.id)}
		onkeydown={() => {}}
		onmouseenter={() => (ed.hoverId = n.id)}
		onmouseleave={() => (ed.hoverId = null)}
	>
		<button class="w-3 text-zinc-400 {n.children.length ? '' : 'invisible'}" onclick={(e) => { e.stopPropagation(); closed[n.id] = !closed[n.id]; }}>{closed[n.id] ? '▸' : '▾'}</button>
		<span class="font-mono text-[10px] text-indigo-500">{depth === 0 ? 'body' : n.tag}</span>
		{#if n.children.length}<span class="text-[10px] text-zinc-300">{dirIcon[n.layout.dir]}</span>{/if}
		<span class="min-w-0 flex-1 truncate {n.text ? 'text-zinc-800' : 'text-zinc-400 italic'}">{n.text || n.prompt}</span>
	</div>
	{#if !closed[n.id]}
		{#each n.children as c (c.id)}{@render item(c, depth + 1)}{/each}
	{/if}
{/snippet}

<div class="h-full overflow-y-auto p-2">{@render item(ed.root, 0)}</div>
