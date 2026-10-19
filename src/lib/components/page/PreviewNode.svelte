<script lang="ts">
	import { layoutStyle, sizeStyle, type Dir, type PageNode } from '#lib/page.ts';
	import MentionText from '../MentionText.svelte';
	import Self from './PreviewNode.svelte';

	let { node, parentDir = null }: { node: PageNode; parentDir?: Dir | null } = $props();
</script>

<div class="pn" style={sizeStyle(node, parentDir)}>
	{#if node.prompt || node.text || !node.children.length}
		<div class="pn-h">
			<span class="pn-tag">{node.tag}</span>
			{#if node.text}<span class="pn-text"><MentionText text={node.text} /></span>{/if}
			{#if node.prompt}<span class="pn-prompt"><MentionText text={node.prompt} /></span>{/if}
		</div>
	{/if}
	{#if node.children.length}
		<div style={layoutStyle(node)}>
			{#each node.children as c (c.id)}<Self node={c} parentDir={node.layout.dir} />{/each}
		</div>
	{/if}
</div>

<style>
	.pn {
		border: 1px dashed #d4d4d8;
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.035);
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow: hidden;
	}
	.pn > div:last-child { flex: 1; }
	.pn-h { display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; font-size: 12px; line-height: 1.35; }
	.pn-tag { font-family: ui-monospace, monospace; font-size: 10px; color: #6366f1; }
	.pn-text { color: #18181b; font-weight: 500; }
	.pn-prompt { color: #71717a; font-style: italic; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>
