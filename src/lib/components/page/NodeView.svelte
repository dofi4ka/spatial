<script lang="ts">
	import { contains, findNode, layoutStyle, sizeStyle, VOID_TAGS, type Dir, type PageNode } from '#lib/page.ts';
	import { DND_TYPE, type PageEditorState } from './editor.svelte';
	import { getContext } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import { splitMentions } from '#lib/mentions.ts';
	import { visualSrc } from '#lib/drawing.ts';
	import MentionText from '../MentionText.svelte';
	import Self from './NodeView.svelte';

	let { ed, node, parentDir = null, isRoot = false }: { ed: PageEditorState; node: PageNode; parentDir?: Dir | null; isRoot?: boolean } = $props();

	let el: HTMLDivElement;
	let childBox = $state<HTMLDivElement>();
	const items = getContext<Record<string, Item> | undefined>('spatial:items') ?? {};
	// <img> elements preview the first image they mention
	let imgSrc = $derived.by(() => {
		if (node.tag !== 'img') return '';
		for (const s of splitMentions(node.text + '\n' + node.prompt)) {
			const src = s.t === 'mention' ? visualSrc(items[s.id]) : '';
			if (src) return src;
		}
		return '';
	});
	let isVoid = $derived(VOID_TAGS.has(node.tag.toLowerCase()));
	let selected = $derived(ed.selectedId === node.id);
	let dropHere = $derived(ed.drop?.parentId === node.id);
	let showChildren = $derived(isRoot || node.children.length > 0 || dropHere);

	function indexAt(e: DragEvent): number {
		if (!childBox) return 0;
		const kids = [...childBox.children].filter((c) => (c as HTMLElement).dataset.node) as HTMLElement[];
		const dir = node.layout.dir;
		for (let i = 0; i < kids.length; i++) {
			const r = kids[i].getBoundingClientRect();
			if (dir === 'row' && !node.layout.wrap ? e.clientX < r.left + r.width / 2 : dir === 'col' ? e.clientY < r.top + r.height / 2 : e.clientY < r.top || (e.clientY < r.bottom && e.clientX < r.left + r.width / 2))
				return i;
		}
		return kids.length;
	}

	function onDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes(DND_TYPE) || !ed.dragging || ed.readonly) return;
		e.preventDefault();
		e.stopPropagation();
		const d = ed.dragging;
		// cannot drop a node into itself
		if (d.kind === 'node') {
			const dragged = findNode(ed.root, d.id);
			if (dragged && contains(dragged, node.id)) return void (ed.drop = null);
		}
		e.dataTransfer.dropEffect = d.kind === 'comp' ? 'copy' : 'move';

		// Near the edge of a non-root element → insert before/after it in the parent.
		if (!isRoot && parentDir) {
			const r = el.getBoundingClientRect();
			const along = parentDir === 'row' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
			const edge = isVoid || node.children.length === 0 ? 0.3 : 0.15;
			if (along < edge || along > 1 - edge || isVoid) {
				const parentEl = el.parentElement!.closest<HTMLElement>('[data-node]')!;
				const siblings = [...el.parentElement!.children].filter((c) => (c as HTMLElement).dataset.node);
				const idx = siblings.indexOf(el) + (along > 0.5 ? 1 : 0);
				return void (ed.drop = { parentId: parentEl.dataset.node!, index: idx });
			}
		}
		ed.drop = { parentId: node.id, index: indexAt(e) };
	}

	function onDrop(e: DragEvent) {
		if (!e.dataTransfer?.types.includes(DND_TYPE)) return;
		e.preventDefault();
		e.stopPropagation();
		const d = ed.dragging, drop = ed.drop;
		ed.drop = null;
		ed.dragging = null;
		if (d && drop) ed.applyDrop(d, drop);
	}
</script>

<div
	bind:this={el}
	data-node={node.id}
	class="nv"
	class:root={isRoot}
	class:sel={selected}
	class:hov={ed.hoverId === node.id && !selected}
	class:target={dropHere}
	style={isRoot ? '' : sizeStyle(node, parentDir)}
	draggable={!isRoot && !ed.readonly}
	role="treeitem"
	aria-selected={selected}
	tabindex="-1"
	onclick={(e) => {
		e.stopPropagation();
		ed.selectedId = node.id;
	}}
	ondblclick={(e) => {
		e.stopPropagation();
		ed.selectedId = node.id;
		ed.focusPrompt++;
	}}
	onmouseover={(e) => {
		e.stopPropagation();
		ed.hoverId = node.id;
	}}
	onmouseleave={() => ed.hoverId === node.id && (ed.hoverId = null)}
	oncontextmenu={(e) => {
		e.preventDefault();
		e.stopPropagation();
		ed.selectedId = node.id;
		ed.menu = { x: e.clientX, y: e.clientY, id: node.id };
	}}
	onfocus={() => {}}
	ondragstart={(e) => {
		e.stopPropagation();
		ed.dragging = { kind: 'node', id: node.id };
		e.dataTransfer!.setData(DND_TYPE, node.id);
		e.dataTransfer!.effectAllowed = 'move';
	}}
	ondragend={() => {
		ed.dragging = null;
		ed.drop = null;
	}}
	ondragover={onDragOver}
	ondrop={onDrop}
>
	{#if !isRoot || node.prompt || node.text}
		<div class="nv-h">
			<span class="nv-tag">{node.tag}</span>
			{#if imgSrc}<img src={imgSrc} alt="" class="nv-img" />{/if}
			{#if node.text}<span class="nv-text"><MentionText text={node.text} /></span>{/if}
			{#if node.prompt}<span class="nv-prompt"><MentionText text={node.prompt} /></span>{/if}
			{#if !node.text && !node.prompt && !node.children.length}<span class="nv-empty">empty — describe it in the inspector</span>{/if}
		</div>
	{/if}
	{#if showChildren && !isVoid}
		<div bind:this={childBox} class="nv-c" class:empty={!node.children.length} style={layoutStyle(node)}>
			{#each node.children as c, i (c.id)}
				{#if dropHere && ed.drop?.index === i}<div class="drop-line" class:v={node.layout.dir === 'row'}></div>{/if}
				<Self {ed} node={c} parentDir={node.layout.dir} />
			{/each}
			{#if dropHere && ed.drop?.index === node.children.length}<div class="drop-line" class:v={node.layout.dir === 'row'}></div>{/if}
			{#if isRoot && !node.children.length && !dropHere}
				<div class="nv-placeholder">{ed.readonly ? 'This page is empty' : 'Drag components here from the left panel'}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.nv {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 5px;
		border: 1px dashed #d4d4d8;
		border-radius: 6px;
		background: rgba(99, 102, 241, 0.03);
		cursor: default;
		min-width: 0;
	}
	/* state highlights use outlines so they never change the layout */
	.nv.root { border: 0; background: transparent; padding: 16px; min-height: 100%; border-radius: 0; }
	.nv.hov { outline: 1px solid #a5b4fc; outline-offset: -1px; }
	.nv.sel { outline: 2px solid #6366f1; outline-offset: -1px; background: rgba(99, 102, 241, 0.06); }
	.nv.target { outline: 2px solid #22c55e; outline-offset: -1px; }
	.nv.root.hov, .nv.root.sel, .nv.root.target { outline-offset: -2px; }
	.nv-c { flex: 1; min-height: 8px; }
	.root > .nv-c { min-height: 300px; }
	.nv-c.empty { min-height: 28px; border-radius: 4px; background: rgba(34, 197, 94, 0.06); }
	.nv-h { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font-size: 13px; line-height: 1.4; padding: 0 2px; }
	.nv-img { display: block; width: 100%; max-height: 220px; object-fit: contain; border-radius: 4px; background: #f4f4f5; order: 10; }
	.nv-tag { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 10.5px; color: #6366f1; background: #eef2ff; border-radius: 4px; padding: 0 4px; }
	.nv-text { color: #18181b; font-weight: 500; white-space: pre-wrap; }
	.nv-prompt { color: #71717a; font-style: italic; white-space: pre-wrap; }
	.nv-empty { color: #a1a1aa; font-size: 11px; }
	.nv-placeholder { color: #a1a1aa; text-align: center; padding: 80px 0; border: 2px dashed #e4e4e7; border-radius: 12px; }
	.drop-line { flex: none; height: 3px; margin: -2px 0; background: #22c55e; border-radius: 2px; align-self: stretch; }
	.drop-line.v { width: 3px; height: auto; margin: 0 -2px; min-height: 20px; }
</style>
