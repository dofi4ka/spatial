<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Item, ItemType } from '#lib/types.ts';
	import { fitSize, imageSize, type ProjectStore } from '#lib/store.svelte.ts';
	import { icons } from '#lib/icons.ts';
	import ItemCard from './ItemCard.svelte';

	let {
		store,
		canvasId,
		active,
		onopen
	}: {
		store: ProjectStore;
		canvasId: string;
		/** false while an editor overlay is open; disables keyboard shortcuts */
		active: boolean;
		onopen: (item: Item) => void;
	} = $props();

	let el: HTMLDivElement;
	let vw = $state(1000);
	let vh = $state(800);
	let vp = $state({ x: 0, y: 0, z: 1 });
	let selection = $state<string[]>([]);
	let renaming = $state<string | null>(null);
	let marquee = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
	let dropTarget = $state<string | null>(null);
	let menu = $state<{ sx: number; sy: number; wx: number; wy: number; item: Item | null } | null>(null);
	let spaceDown = $state(false);
	let panning = $state(false);
	let fileInput: HTMLInputElement;
	let pendingImagePos: { x: number; y: number } | null = null;

	let items = $derived(store.children(canvasId));
	let lod = $derived(vp.z < 0.22);
	let visible = $derived.by(() => {
		const m = 200 / vp.z;
		const x0 = -vp.x / vp.z - m, y0 = -vp.y / vp.z - m;
		const x1 = x0 + vw / vp.z + 2 * m, y1 = y0 + vh / vp.z + 2 * m;
		return items.filter((i) => i.x < x1 && i.x + i.w > x0 && i.y - 30 / vp.z < y1 && i.y + i.h > y0);
	});
	let cursors = $derived(
		Object.entries(store.cursors)
			.filter(([, c]) => c.canvas === canvasId && !c.file && Date.now() - c.t < 15000)
			.map(([id, c]) => ({ id, ...c, user: store.presence.find((p) => p.clientId === id) }))
			.filter((c) => c.user)
	);

	// ---------- viewport ----------

	const vpKey = (id: string) => `spatial:vp:${id}`;

	function loadViewport(id: string) {
		try {
			const saved = localStorage.getItem(vpKey(id));
			if (saved) return void (vp = JSON.parse(saved));
		} catch {}
		fit();
	}

	let saveTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const v = { ...vp };
		const id = canvasId;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			try {
				localStorage.setItem(vpKey(id), JSON.stringify(v));
			} catch {}
		}, 300);
	});

	$effect(() => {
		const id = canvasId;
		untrack(() => {
			selection = [];
			renaming = null;
			loadViewport(id);
		});
	});

	export function fit(only?: Item[]) {
		const list = only ?? items;
		if (!list.length) return void (vp = { x: vw / 2, y: vh / 2, z: 1 });
		let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		for (const i of list) {
			x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y - 30);
			x1 = Math.max(x1, i.x + i.w); y1 = Math.max(y1, i.y + i.h);
		}
		const z = Math.min(2, Math.max(0.05, Math.min((vw - 160) / (x1 - x0), (vh - 200) / (y1 - y0))));
		vp = { z, x: vw / 2 - ((x0 + x1) / 2) * z, y: vh / 2 - ((y0 + y1) / 2) * z };
	}

	function zoomAt(sx: number, sy: number, nz: number) {
		nz = Math.min(4, Math.max(0.03, nz));
		const wx = (sx - vp.x) / vp.z, wy = (sy - vp.y) / vp.z;
		vp = { z: nz, x: sx - wx * nz, y: sy - wy * nz };
	}

	const local = (e: { clientX: number; clientY: number }) => {
		const r = el.getBoundingClientRect();
		return { sx: e.clientX - r.left, sy: e.clientY - r.top };
	};
	const toWorld = (sx: number, sy: number) => ({ x: (sx - vp.x) / vp.z, y: (sy - vp.y) / vp.z });
	const center = () => toWorld(vw / 2, vh / 2);

	onMount(() => {
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const { sx, sy } = local(e);
			if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, vp.z * Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? 0.01 : 0.002)));
			else vp = { ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY };
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	});

	// ---------- pointer interactions ----------

	type Drag =
		| { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
		| { kind: 'marquee'; additive: string[] }
		| { kind: 'move'; sx: number; sy: number; started: boolean; origin: Map<string, { x: number; y: number }>; clickId: string; wasSelected: boolean; shift: boolean }
		| { kind: 'resize'; id: string; sx: number; sy: number; w: number; h: number; ratio: number | null };
	let drag: Drag | null = null;

	function onPointerDown(e: PointerEvent) {
		menu = null;
		if ((e.target as HTMLElement).closest('[data-ui]')) return;
		const { sx, sy } = local(e);
		const target = e.target as HTMLElement;

		if (e.button === 1 || (e.button === 0 && spaceDown)) {
			drag = { kind: 'pan', sx, sy, vx: vp.x, vy: vp.y };
			panning = true;
		} else if (e.button !== 0) {
			return;
		} else if (target.closest('[data-resize]')) {
			const id = target.closest<HTMLElement>('[data-resize]')!.dataset.resize!;
			const it = store.items[id];
			drag = { kind: 'resize', id, sx, sy, w: it.w, h: it.h, ratio: it.type === 'image' ? it.w / it.h : null };
		} else if (target.closest('[data-item]')) {
			const id = target.closest<HTMLElement>('[data-item]')!.dataset.item!;
			const wasSelected = selection.includes(id);
			if (e.shiftKey) selection = wasSelected ? selection : [...selection, id];
			else if (!wasSelected) selection = [id];
			const origin = new Map(selection.map((sid) => [sid, { x: store.items[sid].x, y: store.items[sid].y }]));
			drag = { kind: 'move', sx, sy, started: false, origin, clickId: id, wasSelected, shift: e.shiftKey };
		} else {
			const w = toWorld(sx, sy);
			marquee = { x0: w.x, y0: w.y, x1: w.x, y1: w.y };
			drag = { kind: 'marquee', additive: e.shiftKey ? [...selection] : [] };
			if (!e.shiftKey) selection = [];
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!drag) return;
		const { sx, sy } = local(e);
		const w = toWorld(sx, sy);

		if (drag.kind === 'pan') {
			vp = { ...vp, x: drag.vx + sx - drag.sx, y: drag.vy + sy - drag.sy };
		} else if (drag.kind === 'marquee' && marquee) {
			marquee = { ...marquee, x1: w.x, y1: w.y };
			const [x0, x1] = [Math.min(marquee.x0, marquee.x1), Math.max(marquee.x0, marquee.x1)];
			const [y0, y1] = [Math.min(marquee.y0, marquee.y1), Math.max(marquee.y0, marquee.y1)];
			const hit = items.filter((i) => i.x < x1 && i.x + i.w > x0 && i.y < y1 && i.y + i.h > y0).map((i) => i.id);
			selection = [...new Set([...drag.additive, ...hit])];
		} else if (drag.kind === 'move') {
			const dx = (sx - drag.sx) / vp.z, dy = (sy - drag.sy) / vp.z;
			if (!drag.started && Math.hypot(sx - drag.sx, sy - drag.sy) < 3) return;
			drag.started = true;
			for (const [id, o] of drag.origin) store.update(id, { x: Math.round(o.x + dx), y: Math.round(o.y + dy) }, false);
			dropTarget = findDropTarget(e);
		} else if (drag.kind === 'resize') {
			let nw = Math.max(80, drag.w + (sx - drag.sx) / vp.z);
			let nh = Math.max(60, drag.h + (sy - drag.sy) / vp.z);
			if (drag.ratio && !e.shiftKey) nh = nw / drag.ratio;
			store.update(drag.id, { w: Math.round(nw), h: Math.round(nh) }, false);
		}
	}

	/** Canvas card or breadcrumb under the pointer that the dragged items could move into. */
	function findDropTarget(e: PointerEvent): string | null {
		for (const node of document.elementsFromPoint(e.clientX, e.clientY)) {
			const crumb = (node as HTMLElement).closest?.<HTMLElement>('[data-drop-canvas]');
			if (crumb && crumb.dataset.dropCanvas !== canvasId) return crumb.dataset.dropCanvas!;
			const card = (node as HTMLElement).closest?.<HTMLElement>('[data-item]');
			if (card) {
				const id = card.dataset.item!;
				if (selection.includes(id)) continue;
				const it = store.items[id];
				if (it?.type === 'canvas' && !selection.some((s) => store.isAncestor(s, id))) return id;
				return null;
			}
		}
		return null;
	}

	function onPointerUp(e: PointerEvent) {
		const d = drag;
		drag = null;
		panning = false;
		if (!d) return;
		if (d.kind === 'marquee') marquee = null;
		if (d.kind === 'resize') {
			const it = store.items[d.id];
			store.update(d.id, { w: it.w, h: it.h });
		}
		if (d.kind === 'move') {
			if (!d.started) {
				if (d.shift && d.wasSelected) selection = selection.filter((s) => s !== d.clickId);
				else if (!d.shift) selection = [d.clickId];
				return;
			}
			const target = findDropTarget(e);
			dropTarget = null;
			if (target) moveInto(target, [...d.origin.keys()], d.origin);
			else for (const id of d.origin.keys()) store.update(id, { x: store.items[id].x, y: store.items[id].y });
		}
	}

	/** Moves items into another canvas, placed to the right of its existing content. */
	function moveInto(targetId: string, ids: string[], origin?: Map<string, { x: number; y: number }>) {
		const existing = store.children(targetId).filter((i) => !ids.includes(i.id));
		const pos = (id: string) => origin?.get(id) ?? store.items[id];
		const minX = Math.min(...ids.map((id) => pos(id).x));
		const minY = Math.min(...ids.map((id) => pos(id).y));
		const baseX = existing.length ? Math.max(...existing.map((i) => i.x + i.w)) + 80 : 0;
		const baseY = existing.length ? Math.min(...existing.map((i) => i.y)) : 0;
		for (const id of ids) {
			const p = pos(id);
			store.update(id, { parent_id: targetId, x: Math.round(baseX + p.x - minX), y: Math.round(baseY + p.y - minY) });
		}
		selection = [];
	}

	function onDblClick(e: MouseEvent) {
		const t = e.target as HTMLElement;
		const label = t.closest<HTMLElement>('[data-label]');
		if (label) return void (renaming = label.dataset.label!);
		const card = t.closest<HTMLElement>('[data-item]');
		if (card) return onopen(store.items[card.dataset.item!]);
		if (t.closest('[data-ui]')) return;
		const { sx, sy } = local(e);
		const w = toWorld(sx, sy);
		menu = { sx, sy, wx: w.x, wy: w.y, item: null };
	}

	function onContextMenu(e: MouseEvent) {
		e.preventDefault();
		const { sx, sy } = local(e);
		const w = toWorld(sx, sy);
		const card = (e.target as HTMLElement).closest<HTMLElement>('[data-item]');
		const item = card ? store.items[card.dataset.item!] : null;
		if (item && !selection.includes(item.id)) selection = [item.id];
		menu = { sx, sy, wx: w.x, wy: w.y, item };
	}

	// ---------- actions ----------

	function create(type: ItemType, at = center()) {
		menu = null;
		if (type === 'image') {
			pendingImagePos = at;
			return fileInput.click();
		}
		const it = store.create(type, canvasId, at.x, at.y);
		selection = [it.id];
		renaming = it.id;
	}

	async function addImages(files: File[], at = center()) {
		let offset = 0;
		for (const f of files.filter((f) => f.type.startsWith('image/'))) {
			try {
				const [nw, nh] = await imageSize(f);
				const [w, h] = fitSize(nw, nh);
				const file = await store.upload(f);
				const it = store.create('image', canvasId, at.x + offset, at.y + offset, { w, h, content: file, name: f.name.replace(/\.[^.]+$/, '') || 'Image' });
				selection = [it.id];
				offset += 40;
			} catch (e) {
				alert(`Upload failed: ${(e as Error).message}`);
			}
		}
	}

	function deleteSelection() {
		if (!selection.length) return;
		const nested = selection.filter((id) => store.items[id]?.type === 'canvas' && store.children(id).length);
		if (nested.length && !confirm(`Delete ${selection.length} item(s)? Canvases are deleted with everything inside them.`)) return;
		store.remove(selection);
		selection = [];
	}

	async function duplicateSelection() {
		if (!selection.length) return;
		selection = await store.duplicate(selection);
	}

	function moveToParent() {
		const parent = store.items[canvasId]?.parent_id;
		if (!parent || !selection.length) return;
		moveInto(parent, selection);
		menu = null;
	}

	function rename(id: string, name: string | null) {
		renaming = null;
		if (name !== null && name.trim() && name !== store.items[id]?.name) store.update(id, { name: name.trim() });
	}

	function isTyping(e: Event) {
		const t = e.target as HTMLElement;
		return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (!active || isTyping(e)) return;
		const mod = e.metaKey || e.ctrlKey;
		if (e.code === 'Space') {
			spaceDown = true;
			e.preventDefault();
		} else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
		else if (mod && e.key === 'd') (e.preventDefault(), duplicateSelection());
		else if (mod && e.key === 'a') (e.preventDefault(), (selection = items.map((i) => i.id)));
		else if (e.key === 'Escape') ((selection = []), (menu = null));
		else if (e.key === 'Enter' && selection.length === 1) onopen(store.items[selection[0]]);
		else if (e.key === 'F2' && selection.length === 1) renaming = selection[0];
		else if (e.shiftKey && e.code === 'Digit1') fit();
		else if (e.shiftKey && e.code === 'Digit2' && selection.length) fit(items.filter((i) => selection.includes(i.id)));
		else if (mod && (e.key === '=' || e.key === '+')) (e.preventDefault(), zoomAt(vw / 2, vh / 2, vp.z * 1.25));
		else if (mod && e.key === '-') (e.preventDefault(), zoomAt(vw / 2, vh / 2, vp.z / 1.25));
		else if (mod && e.key === '0') (e.preventDefault(), zoomAt(vw / 2, vh / 2, 1));
		else if (!mod && !e.shiftKey && !e.altKey && e.key === 'c') (e.preventDefault(), create('canvas'));
		else if (!mod && !e.shiftKey && !e.altKey && e.key === 'm') (e.preventDefault(), create('markdown'));
		else if (!mod && !e.shiftKey && !e.altKey && e.key === 'p') (e.preventDefault(), create('page'));
		else if (!mod && !e.shiftKey && !e.altKey && e.key === 'i') (e.preventDefault(), create('image'));
	}

	function onPaste(e: ClipboardEvent) {
		if (!active || isTyping(e)) return;
		const files = [...(e.clipboardData?.files ?? [])];
		if (files.length) {
			e.preventDefault();
			addImages(files);
		}
	}

	let fileDrag = $state(false);
</script>

<svelte:window
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	onkeydown={onKeyDown}
	onkeyup={(e) => e.code === 'Space' && (spaceDown = false)}
	onpaste={onPaste}
	onblur={() => (spaceDown = false)}
/>

<div
	bind:this={el}
	bind:clientWidth={vw}
	bind:clientHeight={vh}
	class="relative h-full w-full touch-none overflow-hidden bg-zinc-50 outline-none"
	class:cursor-grab={spaceDown && !panning}
	class:cursor-grabbing={panning}
	style="background-image:radial-gradient(#d4d4d8 {Math.max(0.6, vp.z)}px, transparent 0);background-size:{24 * vp.z}px {24 * vp.z}px;background-position:{vp.x}px {vp.y}px"
	role="application"
	onpointerdown={onPointerDown}
	onpointermove={(e) => {
		const { sx, sy } = local(e);
		const w = toWorld(sx, sy);
		store.sendCursor(canvasId, null, w.x, w.y);
	}}
	ondblclick={onDblClick}
	oncontextmenu={onContextMenu}
	ondragover={(e) => {
		if (e.dataTransfer?.types.includes('Files')) {
			e.preventDefault();
			fileDrag = true;
		}
	}}
	ondragleave={() => (fileDrag = false)}
	ondrop={(e) => {
		fileDrag = false;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (!files.length) return;
		e.preventDefault();
		const { sx, sy } = local(e);
		addImages(files, toWorld(sx, sy));
	}}
>
	<div class="absolute top-0 left-0 origin-top-left" style="transform:translate({vp.x}px,{vp.y}px) scale({vp.z})">
		{#each visible as item (item.id)}
			<ItemCard
				{store}
				{item}
				zoom={vp.z}
				{lod}
				selected={selection.includes(item.id)}
				dropTarget={dropTarget === item.id}
				renaming={renaming === item.id}
				onrename={(n) => rename(item.id, n)}
			/>
		{/each}

		{#if marquee}
			<div
				class="pointer-events-none absolute border border-indigo-400 bg-indigo-400/10"
				style="left:{Math.min(marquee.x0, marquee.x1)}px;top:{Math.min(marquee.y0, marquee.y1)}px;width:{Math.abs(marquee.x1 - marquee.x0)}px;height:{Math.abs(marquee.y1 - marquee.y0)}px;border-width:{1 / vp.z}px"
			></div>
		{/if}

		{#each cursors as c (c.id)}
			<div class="pointer-events-none absolute top-0 left-0 transition-transform duration-75" style="transform:translate({c.x}px,{c.y}px) scale({1 / vp.z})">
				<svg width="18" height="18" viewBox="0 0 18 18" class="origin-top-left"><path d="M1 1l6 15 2.3-6.2L16 7.5z" fill={c.user!.color} stroke="white" stroke-width="1.2" /></svg>
				<div class="ml-3 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white" style="background:{c.user!.color}">{c.user!.name}</div>
			</div>
		{/each}
	</div>

	{#if items.length === 0}
		<div class="pointer-events-none absolute inset-0 grid place-items-center">
			<div class="text-center text-zinc-400">
				<div class="mb-1 text-base font-medium text-zinc-500">This canvas is empty</div>
				<div class="text-sm">Use the toolbar below, double-click anywhere, or drop images here.</div>
			</div>
		</div>
	{/if}

	{#if fileDrag}
		<div class="pointer-events-none absolute inset-3 grid place-items-center rounded-2xl border-2 border-dashed border-indigo-400 bg-indigo-50/50 text-indigo-600">Drop images to add them</div>
	{/if}

	<!-- toolbar -->
	<div data-ui class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
		{#each [['canvas', 'Canvas', 'C'], ['markdown', 'Markdown', 'M'], ['page', 'Page', 'P'], ['image', 'Image', 'I']] as [t, label, key]}
			<button class="btn-ghost h-9 px-3" title="New {label.toLowerCase()} ({key})" onclick={() => create(t as ItemType)}>
				<span class="text-base">{@html icons[t as ItemType]}</span>{label}
			</button>
		{/each}
	</div>

	<div data-ui class="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
		<button class="icon-btn" title="Zoom out" onclick={() => zoomAt(vw / 2, vh / 2, vp.z / 1.25)}>{@html icons.minus}</button>
		<button class="w-12 text-center text-xs text-zinc-600 tabular-nums" title="Reset to 100%" onclick={() => zoomAt(vw / 2, vh / 2, 1)}>{Math.round(vp.z * 100)}%</button>
		<button class="icon-btn" title="Zoom in" onclick={() => zoomAt(vw / 2, vh / 2, vp.z * 1.25)}>{@html icons.plus}</button>
		<button class="icon-btn" title="Fit content (Shift+1)" onclick={() => fit()}>{@html icons.fit}</button>
	</div>

	{#if menu}
		<div
			data-ui
			class="absolute z-20 min-w-44 rounded-xl border border-zinc-200 bg-white p-1 text-sm shadow-xl"
			style="left:{Math.min(menu.sx, vw - 190)}px;top:{Math.min(menu.sy, vh - 220)}px"
		>
			{#if menu.item}
				{@const it = menu.item}
				<button class="menu-item" onclick={() => ((menu = null), onopen(it))}>Open</button>
				<button class="menu-item" onclick={() => ((menu = null), (renaming = it.id))}>Rename <span class="kbd">F2</span></button>
				<button class="menu-item" onclick={() => ((menu = null), duplicateSelection())}>Duplicate <span class="kbd">⌘D</span></button>
				{#if store.items[canvasId]?.parent_id}
					<button class="menu-item" onclick={moveToParent}>Move to parent canvas</button>
				{/if}
				<div class="my-1 h-px bg-zinc-100"></div>
				<button class="menu-item text-red-600" onclick={() => ((menu = null), deleteSelection())}>Delete <span class="kbd">⌫</span></button>
			{:else}
				{@const at = { x: menu.wx, y: menu.wy }}
				<div class="px-2 py-1 text-[11px] font-medium text-zinc-400 uppercase">Create here</div>
				<button class="menu-item" onclick={() => create('canvas', at)}><span>{@html icons.canvas} Canvas</span><span class="kbd">C</span></button>
				<button class="menu-item" onclick={() => create('markdown', at)}><span>{@html icons.markdown} Markdown</span><span class="kbd">M</span></button>
				<button class="menu-item" onclick={() => create('page', at)}><span>{@html icons.page} Page</span><span class="kbd">P</span></button>
				<button class="menu-item" onclick={() => create('image', at)}><span>{@html icons.image} Image</span><span class="kbd">I</span></button>
			{/if}
		</div>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		onchange={(e) => {
			addImages([...(e.currentTarget.files ?? [])], pendingImagePos ?? center());
			e.currentTarget.value = '';
		}}
	/>
</div>

<style>
	.menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-radius: 8px;
		padding: 6px 8px;
		text-align: left;
		color: #3f3f46;
	}
	.menu-item > span:first-child { display: inline-flex; align-items: center; gap: 8px; }
	.menu-item:hover { background: #f4f4f5; }
</style>
