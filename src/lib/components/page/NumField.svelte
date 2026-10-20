<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	// Figma-style number field: drag the label to scrub, type to set, optional trailing slot.
	let {
		value,
		label,
		title,
		display,
		min = 0,
		max = 9999,
		onchange,
		trailing
	}: {
		value: number;
		label: Snippet;
		title?: string;
		/** text shown instead of the number (e.g. "Hug"); typing a number still works */
		display?: string;
		min?: number;
		max?: number;
		onchange: (v: number, key?: string) => void;
		trailing?: Snippet;
	} = $props();

	let focused = $state(false);
	let justFocused = false;
	let input: HTMLInputElement;
	const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
	const key = Math.random().toString(36).slice(2);

	function scrub(e: PointerEvent) {
		e.preventDefault();
		const start = e.clientX;
		const from = value;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const move = (ev: PointerEvent) => onchange(clamp(from + (ev.clientX - start) / (ev.shiftKey ? 1 : 2)), `scrub:${key}`);
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
	}

	function commit() {
		const n = parseFloat(input.value);
		if (!Number.isNaN(n)) onchange(clamp(n));
		else input.value = display ?? String(value);
	}
</script>

<div class="nf" class:focused {title}>
	<span class="nf-label" role="slider" aria-valuenow={value} tabindex="-1" onpointerdown={scrub}>{@render label()}</span>
	<input
		bind:this={input}
		value={focused || display === undefined ? value : display}
		onfocus={async () => {
			focused = true;
			justFocused = true;
			await tick();
			input.select();
		}}
		onmouseup={(e) => {
			// keep the select-all from focusing when the click ends
			if (justFocused) e.preventDefault();
			justFocused = false;
		}}
		onblur={() => {
			commit();
			focused = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter') e.currentTarget.blur();
			if (e.key === 'Escape') {
				e.currentTarget.value = String(value);
				e.currentTarget.blur();
			}
			if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
				e.preventDefault();
				onchange(clamp(value + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)));
			}
		}}
	/>
	{@render trailing?.()}
</div>

<style>
	.nf {
		display: flex;
		align-items: center;
		height: 28px;
		min-width: 0;
		border-radius: 6px;
		background: #f4f4f5;
		border: 1px solid transparent;
		font-size: 12px;
	}
	.nf:hover { border-color: #e4e4e7; }
	.nf.focused { border-color: #6366f1; background: #fff; }
	.nf-label {
		display: grid;
		place-items: center;
		min-width: 26px;
		height: 100%;
		color: #a1a1aa;
		cursor: ew-resize;
		user-select: none;
		font-size: 11px;
	}
	input {
		flex: 1;
		min-width: 0;
		background: transparent;
		outline: none;
		color: #18181b;
		font-variant-numeric: tabular-nums;
	}
</style>
