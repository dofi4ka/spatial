<script lang="ts">
	import { COMPONENT_COUNT, LIBRARY } from '#lib/components-library.ts';
	import { icons } from '#lib/icons.ts';
	import { DND_TYPE, type PageEditorState } from './editor.svelte';

	let { ed }: { ed: PageEditorState } = $props();
	let q = $state('');
	let collapsed = $state<Record<string, boolean>>({});

	let groups = $derived.by(() => {
		const s = q.trim().toLowerCase();
		return LIBRARY.map((g, gi) => ({
			name: g.name,
			items: g.items
				.map((d, i) => ({ d, gi, i }))
				.filter(({ d }) => !s || d.n.toLowerCase().includes(s) || (d.p ?? '').toLowerCase().includes(s) || (d.t ?? '').includes(s) || g.name.toLowerCase().includes(s))
		})).filter((g) => g.items.length);
	});
</script>

<div class="flex h-full flex-col">
	<div class="border-b border-zinc-100 p-2">
		<label class="flex items-center gap-2 rounded-lg bg-zinc-100 px-2 py-1.5 text-zinc-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
			{@html icons.search}
			<input bind:value={q} placeholder="Search {COMPONENT_COUNT} components…" class="w-full bg-transparent text-sm text-zinc-800 outline-none" />
		</label>
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto p-2">
		{#each groups as g (g.name)}
			<button
				class="flex w-full items-center justify-between px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-800"
				onclick={() => (collapsed[g.name] = !collapsed[g.name])}
			>
				{g.name}
				<span class="text-zinc-300">{collapsed[g.name] && !q ? '▸' : '▾'} {g.items.length}</span>
			</button>
			{#if !collapsed[g.name] || q}
				<div class="mb-2 grid grid-cols-2 gap-1.5">
					{#each g.items as { d, gi, i } (d.n)}
						<button
							class="comp group"
							draggable="true"
							title="{d.n}{d.t ? ` <${d.t}>` : ''}{d.p ? `\n${d.p}` : ''}{d.x ? `\n“${d.x}”` : ''}\n\nDrag onto the page, or click to add after the selected element."
							ondragstart={(e) => {
								ed.dragging = { kind: 'comp', g: gi, i };
								e.dataTransfer!.setData(DND_TYPE, `${gi}:${i}`);
								e.dataTransfer!.effectAllowed = 'copy';
							}}
							ondragend={() => {
								ed.dragging = null;
								ed.drop = null;
							}}
							onclick={() => ed.addComponent(gi, i)}
						>
							<div class="pv">{@html d.v}</div>
							<div class="truncate px-1.5 pb-1 text-left text-[11px] text-zinc-600 group-hover:text-zinc-900">{d.n}</div>
						</button>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="p-6 text-center text-sm text-zinc-400">Nothing matches “{q}”</div>
		{/each}
	</div>
</div>

<style>
	.comp {
		display: flex;
		flex-direction: column;
		border: 1px solid #e4e4e7;
		border-radius: 8px;
		background: #fff;
		overflow: hidden;
		cursor: grab;
		transition: border-color 0.1s, box-shadow 0.1s;
	}
	.comp:hover { border-color: #a5b4fc; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12); }
	.comp:active { cursor: grabbing; }

	/* ---- tiny preview primitives ---- */
	.pv {
		height: 64px;
		padding: 8px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		pointer-events: none;
		font-size: 8px;
		line-height: 1.2;
		color: #3f3f46;
		background: #fafafa;
		border-bottom: 1px solid #f4f4f5;
	}
	.pv :global(i), .pv :global(b) { font-style: normal; }
	.pv :global(.pv-r) { display: flex; align-items: center; gap: 3px; min-width: 0; }
	.pv :global(.pv-k) { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
	.pv :global(.pv-r > .pv-k) { flex: 1; }
	.pv :global(.pv-bx) { display: flex; flex-direction: column; gap: 3px; padding: 4px; border: 1px solid #e4e4e7; border-radius: 4px; background: #fff; min-width: 0; flex: 1; }
	.pv :global(.pv-l) { display: block; height: 3px; border-radius: 2px; background: #d4d4d8; flex: none; }
	.pv :global(.pv-h) { display: block; height: 5px; border-radius: 2px; background: #52525b; flex: none; }
	.pv :global(.pv-t) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 8px; }
	.pv :global(.pv-b), .pv :global(.pv-bs), .pv :global(.pv-bo), .pv :global(.pv-bg), .pv :global(.pv-bd) {
		display: inline-flex; align-items: center; justify-content: center; gap: 2px; padding: 3px 6px; border-radius: 4px; font-size: 8px; font-weight: 600; white-space: nowrap; flex: none; align-self: flex-start;
	}
	.pv :global(.pv-r > .pv-b), .pv :global(.pv-r > .pv-bo), .pv :global(.pv-r > .pv-bs), .pv :global(.pv-r > .pv-bg), .pv :global(.pv-r > .pv-bd) { align-self: center; }
	.pv :global(.pv-b) { background: #4f46e5; color: #fff; }
	.pv :global(.pv-bs) { background: #e4e4e7; color: #27272a; }
	.pv :global(.pv-bo) { border: 1px solid #d4d4d8; background: #fff; color: #3f3f46; }
	.pv :global(.pv-bg) { color: #52525b; }
	.pv :global(.pv-bd) { background: #dc2626; color: #fff; }
	.pv :global(.pv-sqb) { width: 18px; height: 18px; padding: 0; }
	.pv :global(.pv-grp) { gap: 0; }
	.pv :global(.pv-grp > *) { border-radius: 0; }
	.pv :global(.pv-grp > *:first-child) { border-radius: 4px 0 0 4px; }
	.pv :global(.pv-grp > *:last-child) { border-radius: 0 4px 4px 0; margin-left: 1px; }
	.pv :global(.pv-a) { color: #4f46e5; text-decoration: underline; font-size: 8px; }
	.pv :global(.pv-fab) { width: 24px; height: 24px; border-radius: 99px; background: #4f46e5; color: #fff; display: grid; place-items: center; font-size: 12px; box-shadow: 0 2px 6px #4f46e566; align-self: flex-end; }
	.pv :global(.pv-i) { display: flex; align-items: center; gap: 3px; height: 16px; padding: 0 5px; border: 1px solid #d4d4d8; border-radius: 4px; background: #fff; color: #a1a1aa; font-size: 8px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; }
	.pv :global(.pv-otp) { flex: 1; padding: 0; }
	.pv :global(.pv-c) { display: inline-block; border-radius: 99px; background: linear-gradient(135deg, #c7d2fe, #a5b4fc); flex: none; }
	.pv :global(.pv-sq) { display: block; border-radius: 3px; background: linear-gradient(135deg, #e4e4e7, #d4d4d8); flex: none; }
	.pv :global(.pv-ic) { display: inline-block; width: 9px; height: 9px; border-radius: 2px; background: #a1a1aa; flex: none; }
	.pv :global(.pv-bdg) { display: inline-block; padding: 1px 5px; border-radius: 99px; background: #e0e7ff; color: #3730a3; font-size: 7px; font-weight: 600; white-space: nowrap; flex: none; }
	.pv :global(.pv-dot) { display: inline-block; width: 6px; height: 6px; border-radius: 99px; background: #a1a1aa; flex: none; }
	.pv :global(.pv-hr) { display: block; height: 1px; background: #e4e4e7; }
	.pv :global(.pv-chk) { display: inline-block; width: 9px; height: 9px; border-radius: 2px; border: 1px solid #a1a1aa; background: #fff; flex: none; }
	.pv :global(.pv-chk.on) { background: #4f46e5; border-color: #4f46e5; }
	.pv :global(.pv-chk.mid) { background: linear-gradient(#fff 40%, #4f46e5 40% 60%, #fff 60%); border-color: #4f46e5; }
	.pv :global(.pv-rad) { display: inline-block; width: 9px; height: 9px; border-radius: 99px; border: 1px solid #a1a1aa; background: #fff; flex: none; }
	.pv :global(.pv-rad.on) { border: 3px solid #4f46e5; }
	.pv :global(.pv-tg) { display: inline-block; width: 18px; height: 10px; border-radius: 99px; background: #d4d4d8; position: relative; flex: none; }
	.pv :global(.pv-tg::after) { content: ''; position: absolute; top: 1px; left: 1px; width: 8px; height: 8px; border-radius: 99px; background: #fff; }
	.pv :global(.pv-tg.on) { background: #4f46e5; }
	.pv :global(.pv-tg.on::after) { left: 9px; }
	.pv :global(.pv-seg) { display: flex; background: #e4e4e7; border-radius: 5px; padding: 2px; gap: 2px; }
	.pv :global(.pv-seg > i) { flex: 1; text-align: center; padding: 2px; border-radius: 3px; font-size: 7px; }
	.pv :global(.pv-seg > i.on) { background: #fff; box-shadow: 0 1px 2px #0002; }
	.pv :global(.pv-tabs) { display: flex; gap: 6px; border-bottom: 1px solid #e4e4e7; font-size: 7px; }
	.pv :global(.pv-tabs > i) { padding-bottom: 2px; color: #71717a; }
	.pv :global(.pv-tabs > i.on) { color: #18181b; border-bottom: 1.5px solid #4f46e5; }
	.pv :global(.pv-act) { background: #e0e7ff; border-radius: 3px; padding: 2px; }
	.pv :global(.pv-steps > i) { width: 12px; height: 12px; border-radius: 99px; border: 1px solid #a1a1aa; display: grid; place-items: center; font-size: 6px; flex: none; }
	.pv :global(.pv-steps > i.on) { background: #4f46e5; border-color: #4f46e5; color: #fff; }
	.pv :global(.pv-steps > b) { flex: 1; height: 1px; background: #d4d4d8; }
	.pv :global(.pv-sl) { display: block; height: 3px; background: #e4e4e7; border-radius: 2px; position: relative; margin: 6px 0; }
	.pv :global(.pv-sl > i) { position: absolute; left: 0; width: 60%; height: 100%; background: #4f46e5; border-radius: 2px; }
	.pv :global(.pv-sl > i::after) { content: ''; position: absolute; right: -4px; top: -3px; width: 9px; height: 9px; border-radius: 99px; background: #fff; border: 1.5px solid #4f46e5; }
	.pv :global(.pv-sl2 > i) { left: 25%; width: 45%; }
	.pv :global(.pv-sl2 > i::before) { content: ''; position: absolute; left: -4px; top: -3px; width: 9px; height: 9px; border-radius: 99px; background: #fff; border: 1.5px solid #4f46e5; }
	.pv :global(.pv-sw) { display: inline-block; width: 14px; height: 14px; border-radius: 3px; flex: none; }
	.pv :global(.pv-drop) { display: grid; place-items: center; height: 36px; border: 1.5px dashed #a1a1aa; border-radius: 5px; color: #71717a; }
	.pv :global(.pv-cal) { display: block; height: 22px; border: 1px solid #e4e4e7; border-radius: 3px; background: #fff repeating-linear-gradient(90deg, transparent 0 calc(100% / 7 - 1px), #f4f4f5 0 calc(100% / 7)), #fff; }
	.pv :global(.pv-cal.big) { height: 44px; background: repeating-linear-gradient(90deg, transparent 0 calc(100% / 7 - 1px), #e4e4e7 0 calc(100% / 7)), repeating-linear-gradient(transparent 0 10px, #e4e4e7 10px 11px), #fff; }
	.pv :global(.pv-tbl) { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #e4e4e7; border-radius: 3px; overflow: hidden; background: #fff; }
	.pv :global(.pv-tbl > i) { height: 9px; border-bottom: 1px solid #f4f4f5; font-size: 6px; text-align: center; }
	.pv :global(.pv-tbl > i:nth-child(-n + 3)) { background: #f4f4f5; }
	.pv :global(.pv-bar) { display: flex; height: 5px; border-radius: 99px; background: #e4e4e7; overflow: hidden; }
	.pv :global(.pv-bar > i) { background: #4f46e5; }
	.pv :global(.pv-ring) { width: 32px; height: 32px; border-radius: 99px; background: conic-gradient(#4f46e5 72%, #e4e4e7 0); display: grid; place-items: center; font-size: 7px; font-weight: 700; align-self: center; position: relative; }
	.pv :global(.pv-ring::before) { content: ''; position: absolute; inset: 4px; border-radius: 99px; background: #fafafa; z-index: -1; }
	.pv :global(.pv-ring) { isolation: isolate; }
	.pv :global(.pv-code) { display: block; padding: 4px; background: #f4f4f5; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 7px; }
	.pv :global(.pv-kbd) { display: inline-block; padding: 1px 4px; border: 1px solid #d4d4d8; border-bottom-width: 2px; border-radius: 3px; background: #fff; font-size: 8px; font-family: ui-monospace, monospace; margin-right: 2px; }
	.pv :global(.pv-tip) { align-self: flex-start; padding: 2px 5px; border-radius: 3px; background: #18181b; color: #fff; font-size: 7px; }
	.pv :global(.pv-tl) { border-left: 1px solid #d4d4d8; margin-left: 3px; padding-left: 0; }
	.pv :global(.pv-tl .pv-dot) { margin-left: -3.5px; background: #4f46e5; }
	.pv :global(.pv-dim) { display: flex; align-items: center; justify-content: center; padding: 4px; background: #18181b33; border-radius: 3px; height: 48px; }
	.pv :global(.pv-stack) { display: flex; }
	.pv :global(.pv-stack > *) { box-shadow: 0 0 0 1.5px #fafafa; }
	.pv :global(.pv-stack > * + *) { margin-left: -6px; }
	.pv :global(.pv-bub) { align-self: flex-start; padding: 3px 6px; border-radius: 8px 8px 8px 2px; background: #e4e4e7; font-size: 8px; }
	.pv :global(.pv-bub.me) { align-self: flex-end; border-radius: 8px 8px 2px 8px; background: #4f46e5; color: #fff; }
	.pv :global(.pv-cnt) { position: absolute; top: -4px; right: -6px; min-width: 10px; height: 10px; border-radius: 99px; background: #ef4444; color: #fff; font-size: 6px; display: grid; place-items: center; }
	.pv :global(.pv-wave) { flex: 1; height: 12px; background: repeating-linear-gradient(90deg, #a5b4fc 0 2px, transparent 2px 4px); mask: linear-gradient(transparent 20%, #000 20% 80%, transparent 80%); }
	.pv :global(.pv-chart) { display: block; height: 40px; }
	.pv :global(.pv-chart svg) { width: 100%; height: 100%; }
	.pv :global(.pv-heat) { display: grid; grid-template-columns: repeat(14, 1fr); gap: 1.5px; }
	.pv :global(.pv-heat > i) { aspect-ratio: 1; background: #22c55e; border-radius: 1px; }
	.pv :global(.pv-bento) { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 14px; gap: 3px; }
	.pv :global(.pv-bento > i) { background: linear-gradient(135deg, #e4e4e7, #d4d4d8); border-radius: 3px; }
	.pv :global(.pv-flip) { padding: 3px 4px; background: #18181b; color: #fff; border-radius: 3px; font-weight: 700; font-size: 9px; font-family: ui-monospace, monospace; }
	.pv :global(.pv-spin) { width: 18px; height: 18px; border-radius: 99px; border: 2.5px solid #e4e4e7; border-top-color: #4f46e5; align-self: center; }
</style>
