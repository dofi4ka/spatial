<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import { DEFAULT_SIZE, type ProjectStore } from '#lib/store.svelte.ts';
	import { countNodes, emptyPage, findNode, findParent, makeNode, pageToHtml, VOID_TAGS, type PageNode } from '#lib/page.ts';
	import { icons } from '#lib/icons.ts';
	import { mentionToken, planExport, replacePageMentions, resolverFor } from '#lib/mentions.ts';
	import { PageEditorState, readClipboard } from '../page/editor.svelte';
	import NodeView from '../page/NodeView.svelte';
	import ComponentLibrary from '../page/ComponentLibrary.svelte';
	import Inspector from '../page/Inspector.svelte';
	import Layers from '../page/Layers.svelte';

	let { store, item, onopen }: { store: ProjectStore; item: Item; onopen?: (item: Item) => void } = $props();

	let lastLocal = item.content;
	let lastEdit = 0;
	let saveTimer: ReturnType<typeof setTimeout>;

	// svelte-ignore state_referenced_locally
	const readonly = store.readonly;
	const ed = new PageEditorState(
		item.content,
		(json) => {
			lastLocal = json;
			lastEdit = Date.now();
			clearTimeout(saveTimer);
			saveTimer = setTimeout(() => store.update(item.id, { content: json }), 350);
		},
		readonly
	);
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

	let leftTab = $state<'components' | 'layers'>(readonly ? 'layers' : 'components');
	let rightTab = $state<'inspect' | 'html'>('inspect');
	let width = $state<'full' | 768 | 390>('full');
	let html = $derived(rightTab === 'html' ? pageToHtml(ed.root, resolverFor(planExport(Object.values(store.items), store.rootId), item.id)) : '');
	let copied = $state(false);

	// ---------- move to separate page ----------

	let notice = $state<{ text: string; item: Item } | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout>;

	/** A short page name from the first text or prompt in the element (or its tag). */
	function componentName(n: PageNode) {
		const plain = (s: string) => replacePageMentions(s, (_, name) => name).replace(/\s+/g, ' ').trim();
		const describe = (n: PageNode): string => plain(n.text) || plain(n.prompt) || n.children.map(describe).find(Boolean) || '';
		let base = describe(n) || n.tag;
		if (base.length > 40) base = base.slice(0, 40).replace(/\s+\S*$/, '') + '…';
		base = base.charAt(0).toUpperCase() + base.slice(1);
		const taken = new Set(Object.values(store.items).filter((i) => i.type === 'page').map((i) => i.name.toLowerCase()));
		let name = base;
		for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`;
		return name;
	}

	/** Free spot next to this page on its canvas. */
	function freeSpot(w: number, h: number) {
		const siblings = store.children(item.parent_id!);
		const x = item.x + item.w + 80;
		let y = item.y;
		const hit = (y: number) => siblings.some((s) => s.x < x + w && s.x + s.w > x && s.y - 40 < y + h && s.y + s.h + 40 > y);
		for (let i = 0; i < 50 && hit(y); i++) y += h + 60;
		return { x, y };
	}

	/** Cuts the element into a new page next to this one and leaves a div that mentions it. */
	function moveToPage(id: string) {
		const node = findNode(ed.root, id);
		if (!node || id === ed.root.id || !item.parent_id) return;
		const snap = $state.snapshot(node) as PageNode;
		const name = componentName(snap);
		const page = emptyPage();
		page.children = [snap];
		const [w, h] = DEFAULT_SIZE.page;
		const at = freeSpot(w, h);
		const created = store.create('page', item.parent_id, at.x + w / 2, at.y + h / 2, { name, content: JSON.stringify(page) });
		const l = snap.layout;
		ed.replaceNode(id, makeNode({ tag: 'div', prompt: mentionToken(name, created.id), layout: { w: l.w, h: l.h, wv: l.wv, hv: l.hv } }));
		notice = { text: `Moved to “${name}”`, item: created };
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = null), 6000);
	}

	// ---------- context menu ----------

	type MenuAction = { label: string; key?: string; icon?: string; run: () => void; disabled?: boolean; danger?: boolean };

	let menuGroups = $derived.by((): MenuAction[][] => {
		const m = ed.menu;
		const n = m && findNode(ed.root, m.id);
		if (!m || !n) return [];
		const id = n.id;
		const clip = !!readClipboard();
		const isVoid = VOID_TAGS.has(n.tag);
		const edit: MenuAction = { label: 'Edit prompt', key: '↵', icon: icons.sparkle, run: () => ((rightTab = 'inspect'), ed.focusPrompt++) };
		if (readonly)
			return id === ed.root.id
				? []
				: [
						[{ label: 'Copy', key: '⌘C', icon: icons.copy, run: () => ed.copy(id) }],
						[{ label: 'Select parent', key: 'Esc', icon: icons.parent, run: () => (ed.selectedId = findParent(ed.root, id)?.id ?? ed.root.id) }]
					];
		if (id === ed.root.id)
			return [
				[{ label: 'Paste inside', key: '⇧⌘V', icon: icons.paste, run: () => ed.paste(true), disabled: !clip }],
				[
					{ label: 'Add div inside', key: '⇧D', icon: icons.wrap, run: () => ed.addBlank('div', true) },
					{ label: 'Add text inside', key: '⇧T', icon: icons.text, run: () => ed.addBlank('text', true) }
				],
				[edit]
			];
		return [
			[
				{ label: 'Copy', key: '⌘C', icon: icons.copy, run: () => ed.copy(id) },
				{ label: 'Cut', key: '⌘X', icon: icons.scissors, run: () => ed.cut(id) },
				{ label: 'Paste after', key: '⌘V', icon: icons.paste, run: () => ed.paste(), disabled: !clip },
				{ label: 'Paste inside', key: '⇧⌘V', icon: icons.paste, run: () => ed.paste(true), disabled: !clip || isVoid }
			],
			[
				{ label: 'Add div below', key: 'D', icon: icons.wrap, run: () => ed.addBlank('div') },
				{ label: 'Add div inside', key: '⇧D', icon: icons.wrap, run: () => ed.addBlank('div', true), disabled: isVoid },
				{ label: 'Add text below', key: 'T', icon: icons.text, run: () => ed.addBlank('text') },
				{ label: 'Add text inside', key: '⇧T', icon: icons.text, run: () => ed.addBlank('text', true), disabled: isVoid }
			],
			[
				{ label: 'Wrap in div', key: '⌘G', icon: icons.wrap, run: () => ed.wrap(id) },
				...(n.children.length ? [{ label: 'Unwrap', key: '⇧⌘G', icon: icons.layers, run: () => ed.unwrap(id) }] : []),
				{ label: 'Duplicate', key: '⌘D', icon: icons.copy, run: () => ed.duplicate(id) },
				{ label: 'Move to separate page', icon: icons.extract, run: () => moveToPage(id) }
			],
			[
				{ label: 'Move up', key: '⌥↑', icon: icons.up, run: () => ed.shift(id, -1) },
				{ label: 'Move down', key: '⌥↓', icon: icons.down, run: () => ed.shift(id, 1) },
				{ label: 'Select parent', key: 'Esc', icon: icons.parent, run: () => (ed.selectedId = findParent(ed.root, id)?.id ?? ed.root.id) },
				edit
			],
			[{ label: 'Delete', key: '⌫', icon: icons.trash, run: () => ed.remove(id), danger: true }]
		];
	});

	let menuEl = $state<HTMLDivElement>();
	let menuPos = $state({ x: 0, y: 0 });
	$effect(() => {
		const m = ed.menu;
		if (!m || !menuEl) return;
		const r = menuEl.getBoundingClientRect();
		menuPos = { x: Math.max(8, Math.min(m.x, innerWidth - r.width - 8)), y: Math.max(8, Math.min(m.y, innerHeight - r.height - 8)) };
	});

	function isTyping(e: Event) {
		const t = e.target as HTMLElement;
		return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
	}

	function onKey(e: KeyboardEvent) {
		if (ed.menu) {
			if (e.key === 'Escape') e.preventDefault();
			ed.menu = null;
			if (e.key === 'Escape') return;
		}
		const mod = e.metaKey || e.ctrlKey;
		const k = e.key.toLowerCase();
		if (mod && e.key === 'z' && !isTyping(e)) {
			e.preventDefault();
			return e.shiftKey ? ed.redo() : ed.undo();
		}
		if (mod && e.key === 'y' && !isTyping(e)) return (e.preventDefault(), ed.redo());
		if (isTyping(e)) {
			if (e.key === 'Escape') (e.target as HTMLElement).blur();
			return;
		}
		if (readonly) {
			const id = ed.selectedId;
			if (id && mod && k === 'c' && id !== ed.root.id) ed.copy(id);
			else if (id && e.key === 'Escape') ed.selectedId = findParent(ed.root, id)?.id ?? ed.root.id;
			return;
		}
		if (!mod && !e.altKey && (e.code === 'KeyD' || e.code === 'KeyT')) {
			e.preventDefault();
			return ed.addBlank(e.code === 'KeyD' ? 'div' : 'text', e.shiftKey);
		}
		const id = ed.selectedId;
		if (!id) return;
		const notRoot = id !== ed.root.id;
		if ((e.key === 'Delete' || e.key === 'Backspace') && notRoot) (e.preventDefault(), ed.remove(id));
		else if (mod && k === 'd' && notRoot) (e.preventDefault(), ed.duplicate(id));
		else if (mod && k === 'g' && notRoot) (e.preventDefault(), e.shiftKey ? ed.unwrap(id) : ed.wrap(id));
		else if (mod && k === 'c' && notRoot) ed.copy(id);
		else if (mod && k === 'x' && notRoot) ed.cut(id);
		else if (mod && k === 'v') (e.preventDefault(), ed.paste(e.shiftKey));
		else if (e.key === 'Escape') ed.selectedId = findParent(ed.root, id)?.id ?? ed.root.id;
		else if (e.altKey && e.key === 'ArrowUp') (e.preventDefault(), ed.shift(id, -1));
		else if (e.altKey && e.key === 'ArrowDown') (e.preventDefault(), ed.shift(id, 1));
		else if (e.key === 'Enter') (e.preventDefault(), ed.focusPrompt++);
	}
</script>

<svelte:window onkeydown={onKey} />

{#if ed.menu && menuGroups.length}
	<div class="fixed inset-0 z-50" role="presentation" onpointerdown={() => (ed.menu = null)} oncontextmenu={(e) => (e.preventDefault(), (ed.menu = null))}></div>
	<div bind:this={menuEl} role="menu" class="fixed z-50 w-60 rounded-xl border border-zinc-200 bg-white p-1 text-[13px] shadow-xl" style="left:{menuPos.x}px;top:{menuPos.y}px">
		{#each menuGroups as group, gi}
			{#if gi > 0}<div class="my-1 h-px bg-zinc-100"></div>{/if}
			{#each group as a}
				<button
					role="menuitem"
					class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition {a.disabled ? 'cursor-default opacity-35' : a.danger ? 'text-red-600 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-100'}"
					disabled={a.disabled}
					onclick={() => {
						ed.menu = null;
						a.run();
					}}
				>
					<span class="w-4 shrink-0 text-zinc-400">{@html a.icon ?? ''}</span>
					<span class="flex-1">{a.label}</span>
					{#if a.key}<span class="kbd">{a.key}</span>{/if}
				</button>
			{/each}
		{/each}
	</div>
{/if}

<div class="flex h-full min-h-0">
	<!-- left: components / layers -->
	<aside class="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white">
		<div class="flex gap-1 border-b border-zinc-100 p-1.5" class:hidden={readonly}>
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
			{#if !readonly}
			<button class="icon-btn" title="Undo (⌘Z)" disabled={!ed.canUndo} class:opacity-30={!ed.canUndo} onclick={() => ed.undo()}>{@html icons.undo}</button>
			<button class="icon-btn" title="Redo (⇧⌘Z)" disabled={!ed.canRedo} class:opacity-30={!ed.canRedo} onclick={() => ed.redo()}>{@html icons.redo}</button>
			<div class="mx-2 h-5 w-px bg-zinc-200"></div>
			<button class="btn-ghost h-8 text-xs" title="Add div after the selection (D) · Shift-click / Shift+D adds it inside" onclick={(e) => ed.addBlank('div', e.shiftKey)}>
				{@html icons.wrap} Div <span class="kbd">D</span>
			</button>
			<button class="btn-ghost h-8 text-xs" title="Add text after the selection (T) · Shift-click / Shift+T adds it inside" onclick={(e) => ed.addBlank('text', e.shiftKey)}>
				{@html icons.text} Text <span class="kbd">T</span>
			</button>
			<div class="mx-2 h-5 w-px bg-zinc-200"></div>
			{/if}
			<button class="icon-btn {width === 'full' ? 'bg-zinc-100 text-zinc-900' : ''}" title="Desktop" onclick={() => (width = 'full')}>{@html icons.desktop}</button>
			<button class="icon-btn {width === 768 ? 'bg-zinc-100 text-zinc-900' : ''}" title="Tablet · 768px" onclick={() => (width = 768)}>{@html icons.tablet}</button>
			<button class="icon-btn {width === 390 ? 'bg-zinc-100 text-zinc-900' : ''}" title="Mobile · 390px" onclick={() => (width = 390)}>{@html icons.mobile}</button>
			<div class="flex-1"></div>
			{#if notice}
				{@const target = notice.item}
				<span class="flex items-center gap-2 rounded-full bg-amber-50 py-0.5 pr-1 pl-2.5 text-xs text-amber-800">
					{notice.text}
					<button class="rounded-full bg-white px-2 py-0.5 font-medium shadow-sm hover:bg-amber-100" onclick={() => onopen?.(store.items[target.id] ?? target)}>Open</button>
				</span>
			{:else}
				<span class="hidden text-[11px] text-zinc-400 lg:inline">{readonly ? 'View only · right-click an element to copy it into your own page' : 'Right-click an element for actions'}</span>
			{/if}
		</div>
		<div
			class="min-h-0 flex-1 overflow-auto p-6"
			role="presentation"
			onclick={() => (ed.selectedId = ed.root.id)}
			oncontextmenu={(e) => {
				e.preventDefault();
				ed.selectedId = ed.root.id;
				ed.menu = { x: e.clientX, y: e.clientY, id: ed.root.id };
			}}
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
				<fieldset disabled={readonly} class="min-w-0"><Inspector {ed} {store} pageId={item.id} {onopen} /></fieldset>
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
