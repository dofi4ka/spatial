<script lang="ts">
	import type { Align, Dir, Justify, Layout, PageNode, Size } from '#lib/page.ts';
	import NumField from './NumField.svelte';

	// Figma-like auto layout controls: flow, resizing, alignment + gap, padding, clip.
	let {
		node,
		isRoot,
		set
	}: { node: PageNode; isRoot: boolean; set: (patch: Partial<Layout>, key?: string) => void } = $props();

	let l = $derived(node.layout);
	let flex = $derived(l.dir !== 'none');
	let horizontalMain = $derived(l.dir === 'row' || l.dir === 'grid');
	let individual = $state(false);
	let showIndividual = $derived(individual || l.pt !== l.pb || l.pl !== l.pr);

	const FLOWS: { dir: Dir; title: string; icon: string }[] = [
		{ dir: 'none', title: 'No auto layout', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>' },
		{ dir: 'col', title: 'Vertical', icon: '<rect x="5" y="3" width="10" height="6" rx="1"/><rect x="5" y="13" width="10" height="6" rx="1"/><path d="M20 5v14m0 0-2-2m2 2 2-2"/>' },
		{ dir: 'row', title: 'Horizontal', icon: '<rect x="3" y="4" width="6" height="10" rx="1"/><rect x="12" y="4" width="6" height="10" rx="1"/><path d="M4 20h15m0 0-2-2m2 2-2 2"/>' },
		{ dir: 'grid', title: 'Grid', icon: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>' }
	];
	const svg = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

	// ----- alignment grid: columns = horizontal position, rows = vertical position -----
	const POS: ('start' | 'center' | 'end')[] = ['start', 'center', 'end'];
	const pos = (a: Align | Justify) => (a === 'center' ? 1 : a === 'end' ? 2 : 0);

	/** [row, col] of the active cell */
	let active = $derived.by(() => {
		const main = pos(l.justify);
		const cross = pos(l.align);
		return horizontalMain ? [cross, main] : [main, cross];
	});
	let stretched = $derived(l.align === 'stretch');
	let spaced = $derived(l.justify === 'between' || l.justify === 'around');

	function pick(row: number, col: number) {
		const main = horizontalMain ? col : row;
		const cross = horizontalMain ? row : col;
		set({ align: POS[cross], ...(spaced ? {} : { justify: POS[main] }) });
	}

	function cellOn(row: number, col: number) {
		const [ar, ac] = active;
		const crossIdx = horizontalMain ? row : col;
		const mainIdx = horizontalMain ? col : row;
		const crossOk = stretched || crossIdx === (horizontalMain ? ar : ac);
		const mainOk = spaced || mainIdx === (horizontalMain ? ac : ar);
		return crossOk && mainOk;
	}

	// ----- resizing -----
	const SIZE_LABEL: Record<Size, string> = { auto: 'Auto', hug: 'Hug', fill: 'Fill', fixed: 'Fixed' };
</script>

{#snippet sizeField(axis: 'w' | 'h')}
	{@const mode = l[axis]}
	{@const valKey = axis === 'w' ? 'wv' : 'hv'}
	<NumField
		value={l[valKey]}
		display={mode === 'fixed' ? undefined : SIZE_LABEL[mode]}
		title={axis === 'w' ? 'Width' : 'Height'}
		onchange={(v, k) => set({ [valKey]: v, [axis]: 'fixed' }, k)}
	>
		{#snippet label()}{axis.toUpperCase()}{/snippet}
		{#snippet trailing()}
			<select class="nf-select" value={mode} onchange={(e) => set({ [axis]: e.currentTarget.value as Size })} title="Resizing">
				<option value="fixed">Fixed {axis === 'w' ? 'width' : 'height'}</option>
				<option value="hug">Hug contents</option>
				<option value="fill">Fill container</option>
				<option value="auto">Auto</option>
			</select>
		{/snippet}
	</NumField>
{/snippet}

<div class="panel">
	<div class="head">Auto layout</div>

	<div class="sec">
		<div class="sec-title">Flow</div>
		<div class="flex items-center gap-1.5">
			<div class="seg-ic">
				{#each FLOWS as f}
					<button class:on={l.dir === f.dir} title={f.title} onclick={() => set({ dir: f.dir })}>{@html svg(f.icon)}</button>
				{/each}
			</div>
			<button
				class="ic-btn"
				class:on={l.wrap}
				disabled={l.dir !== 'row'}
				title="Wrap"
				onclick={() => set({ wrap: !l.wrap })}
			>{@html svg('<path d="M4 6h13a3 3 0 0 1 0 6H7m0 0 3-3m-3 3 3 3"/><path d="M4 18h6"/>')}</button>
		</div>
		{#if l.dir === 'grid'}
			<div class="mt-1.5 grid grid-cols-2 gap-1.5">
				<NumField value={l.cols} min={1} max={12} title="Columns" onchange={(v, k) => set({ cols: v }, k)}>
					{#snippet label()}{@html svg('<path d="M5 4v16M12 4v16M19 4v16"/>')}{/snippet}
				</NumField>
			</div>
		{/if}
	</div>

	{#if !isRoot}
		<div class="sec">
			<div class="sec-title">Resizing</div>
			<div class="grid grid-cols-2 gap-1.5">
				{@render sizeField('w')}
				{@render sizeField('h')}
			</div>
		</div>
	{/if}

	{#if flex}
		<div class="sec">
			<div class="grid grid-cols-[auto_1fr] gap-x-3">
				<div class="sec-title">Alignment</div>
				<div class="sec-title">Gap</div>
				<div class="align-box" class:stretch={stretched} class:col={!horizontalMain}>
					{#each [0, 1, 2] as row}
						{#each [0, 1, 2] as col}
							<button class="cell" class:on={cellOn(row, col)} title="{POS[row]} / {POS[col]}" onclick={() => pick(row, col)}>
								<i></i>
							</button>
						{/each}
					{/each}
				</div>
				<div class="flex flex-col gap-1.5">
					<NumField
						value={l.gap}
						display={l.justify === 'between' ? 'Auto' : undefined}
						title="Gap between items"
						onchange={(v, k) => set({ gap: v, ...(l.justify === 'between' ? { justify: 'start' } : {}) }, k)}
					>
						{#snippet label()}{@html svg(horizontalMain ? '<path d="M4 5v14M20 5v14M9 12h6"/>' : '<path d="M5 4h14M5 20h14M12 9v6"/>')}{/snippet}
						{#snippet trailing()}
							<select
								class="nf-select"
								value={l.justify === 'between' ? 'auto' : 'fixed'}
								onchange={(e) => set({ justify: e.currentTarget.value === 'auto' ? 'between' : 'start' })}
								title="Gap mode"
							>
								<option value="fixed">Fixed gap</option>
								<option value="auto">Auto (space between)</option>
							</select>
						{/snippet}
					</NumField>
					<button
						class="txt-btn"
						class:on={stretched}
						title="Stretch children across the {horizontalMain ? 'height' : 'width'}"
						onclick={() => set({ align: stretched ? 'start' : 'stretch' })}
					>{@html svg(horizontalMain ? '<path d="M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3"/>' : '<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>')} Stretch</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="sec">
		<div class="flex items-center justify-between">
			<div class="sec-title">Padding</div>
			<button class="ic-btn sm" class:on={showIndividual} title="Individual padding" onclick={() => (individual = !showIndividual)}>
				{@html svg('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>')}
			</button>
		</div>
		{#if showIndividual}
			<div class="grid grid-cols-2 gap-1.5">
				<NumField value={l.pl} title="Left" onchange={(v, k) => set({ pl: v }, k)}>{#snippet label()}{@html svg('<path d="M5 4v16"/><rect x="9" y="8" width="10" height="8" rx="1"/>')}{/snippet}</NumField>
				<NumField value={l.pt} title="Top" onchange={(v, k) => set({ pt: v }, k)}>{#snippet label()}{@html svg('<path d="M4 5h16"/><rect x="8" y="9" width="8" height="10" rx="1"/>')}{/snippet}</NumField>
				<NumField value={l.pr} title="Right" onchange={(v, k) => set({ pr: v }, k)}>{#snippet label()}{@html svg('<path d="M19 4v16"/><rect x="5" y="8" width="10" height="8" rx="1"/>')}{/snippet}</NumField>
				<NumField value={l.pb} title="Bottom" onchange={(v, k) => set({ pb: v }, k)}>{#snippet label()}{@html svg('<path d="M4 19h16"/><rect x="8" y="5" width="8" height="10" rx="1"/>')}{/snippet}</NumField>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-1.5">
				<NumField value={l.pl} title="Horizontal padding" onchange={(v, k) => set({ pl: v, pr: v }, k)}>
					{#snippet label()}{@html svg('<path d="M4 5v14M20 5v14"/><rect x="8" y="8" width="8" height="8" rx="1"/>')}{/snippet}
				</NumField>
				<NumField value={l.pt} title="Vertical padding" onchange={(v, k) => set({ pt: v, pb: v }, k)}>
					{#snippet label()}{@html svg('<path d="M5 4h14M5 20h14"/><rect x="8" y="8" width="8" height="8" rx="1"/>')}{/snippet}
				</NumField>
			</div>
		{/if}
	</div>

	<label class="sec flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
		<input type="checkbox" checked={l.clip} onchange={(e) => set({ clip: e.currentTarget.checked })} /> Clip content
	</label>
</div>

<style>
	.panel { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid #f4f4f5; padding-top: 12px; }
	.head { font-size: 12px; font-weight: 600; color: #18181b; }
	.sec { display: flex; flex-direction: column; gap: 6px; }
	.sec-title { font-size: 11px; color: #71717a; margin-bottom: 2px; }

	.seg-ic { display: flex; flex: 1; gap: 2px; padding: 2px; border-radius: 6px; background: #f4f4f5; }
	.seg-ic > button { flex: 1; display: grid; place-items: center; height: 24px; border-radius: 4px; color: #71717a; }
	.seg-ic > button:hover { color: #18181b; }
	.seg-ic > button.on { background: #fff; color: #18181b; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }

	.ic-btn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; color: #71717a; }
	.ic-btn.sm { width: 24px; height: 24px; }
	.ic-btn:hover:not(:disabled) { background: #f4f4f5; color: #18181b; }
	.ic-btn.on { background: #e0e7ff; color: #4338ca; }
	.ic-btn:disabled { opacity: 0.3; }

	.txt-btn { display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 6px; border-radius: 6px; font-size: 11px; color: #71717a; background: #f4f4f5; }
	.txt-btn:hover { color: #18181b; }
	.txt-btn.on { background: #e0e7ff; color: #4338ca; }

	.align-box { display: grid; grid-template-columns: repeat(3, 20px); grid-template-rows: repeat(3, 20px); padding: 4px; gap: 0; border-radius: 6px; background: #f4f4f5; }
	.cell { display: grid; place-items: center; }
	.cell > i { width: 3px; height: 3px; border-radius: 1px; background: #c4c4cc; transition: all 0.08s; }
	.cell:hover > i { background: #71717a; }
	/* active cells show small bars, like Figma */
	.cell.on > i { background: #6366f1; width: 10px; height: 3px; }
	.align-box:not(.col) .cell.on > i { width: 3px; height: 10px; }
	.align-box.stretch .cell.on > i { width: 3px; height: 16px; }
	.align-box.stretch.col .cell.on > i { width: 16px; height: 3px; }

	:global(.nf-select) {
		width: 18px;
		height: 100%;
		margin-right: 2px;
		appearance: none;
		background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center / 12px no-repeat;
		color: transparent;
		cursor: pointer;
		outline: none;
	}
	:global(.nf-select option) { color: #18181b; }
</style>
