<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { icons } from '#lib/icons.ts';
	import { renderMarkdown } from '#lib/markdown.ts';
	import { compactOutputs, makeCell, parseNotebook, type Cell, type Output } from '#lib/notebook.ts';
	import { PythonKernel } from '#lib/python.svelte.ts';
	import CodeInput from '../notebook/CodeInput.svelte';
	import OutputView from '../notebook/OutputView.svelte';

	let { store, item }: { store: ProjectStore; item: Item } = $props();

	// svelte-ignore state_referenced_locally
	let nb = $state(parseNotebook(item.content));
	// svelte-ignore state_referenced_locally
	let lastLocal = item.content;
	let lastEdit = 0;
	let saveTimer: ReturnType<typeof setTimeout>;

	const kernel = new PythonKernel();
	/** cell id → 'queued' | 'running' */
	let runState = $state<Record<string, 'queued' | 'running'>>({});
	let logs = $state<Record<string, string>>({});
	let editingMd = $state<string | null>(null);
	const inputs: Record<string, CodeInput> = {};

	// svelte-ignore state_referenced_locally
	const readonly = store.readonly;

	function save(now = false) {
		if (readonly) return;
		lastLocal = JSON.stringify($state.snapshot(nb));
		lastEdit = Date.now();
		clearTimeout(saveTimer);
		if (now) store.update(item.id, { content: lastLocal });
		else saveTimer = setTimeout(() => store.update(item.id, { content: lastLocal }), 400);
	}

	onDestroy(() => {
		clearTimeout(saveTimer);
		kernel.stop();
		if (lastLocal !== store.items[item.id]?.content) store.update(item.id, { content: lastLocal });
	});

	// remote edits replace the notebook while we're idle
	let retry: ReturnType<typeof setTimeout>;
	$effect(() => {
		const r = store.remote;
		if (!r || r.id !== item.id) return;
		const apply = () => {
			const c = store.items[item.id]?.content;
			if (c === undefined || c === lastLocal) return;
			if (Date.now() - lastEdit < 1500 || Object.keys(runState).length) return void (retry = setTimeout(apply, 800));
			lastLocal = c;
			nb = parseNotebook(c);
		};
		clearTimeout(retry);
		apply();
	});

	const find = (id: string) => nb.cells.find((c) => c.id === id);

	async function run(id: string) {
		const cell = find(id);
		if (!cell || runState[id]) return;
		if (cell.kind === 'md') return void (editingMd = null);
		runState[id] = 'queued';
		const outs: Output[] = [];
		cell.outputs = [];
		await kernel.run(
			cell.src,
			(o) => {
				runState[id] = 'running';
				delete logs[id];
				outs.push(o);
				const c = find(id);
				if (c) c.outputs = compactOutputs(outs);
			},
			(l) => ((runState[id] = 'running'), (logs[id] = l))
		);
		delete runState[id];
		delete logs[id];
		save(true);
	}

	async function runAndAdvance(id: string) {
		run(id);
		const i = nb.cells.findIndex((c) => c.id === id);
		if (i === nb.cells.length - 1) return readonly ? undefined : add('code', i + 1);
		const next = nb.cells[i + 1];
		if (next.kind === 'md') editingMd = next.id;
		await tick();
		inputs[next.id]?.focus();
	}

	function runAll() {
		editingMd = null;
		for (const c of nb.cells) if (c.kind === 'code' && c.src.trim()) run(c.id);
	}

	function stop() {
		kernel.stop();
		runState = {};
		logs = {};
	}

	async function add(kind: Cell['kind'], at = nb.cells.length) {
		const c = makeCell(kind);
		nb.cells.splice(at, 0, c);
		save();
		if (kind === 'md') editingMd = c.id;
		await tick();
		inputs[c.id]?.focus();
	}

	function remove(id: string) {
		nb.cells = nb.cells.filter((c) => c.id !== id);
		if (!nb.cells.length) nb.cells.push(makeCell());
		save();
	}

	function shift(id: string, d: number) {
		const i = nb.cells.findIndex((c) => c.id === id);
		const j = i + d;
		if (j < 0 || j >= nb.cells.length) return;
		const [c] = nb.cells.splice(i, 1);
		nb.cells.splice(j, 0, c);
		save();
	}

	function toggleKind(c: Cell) {
		c.kind = c.kind === 'code' ? 'md' : 'code';
		c.outputs = [];
		editingMd = c.kind === 'md' ? c.id : null;
		save();
	}

	const statusText = { off: 'Python · starts on first run', loading: 'Loading Python…', idle: 'Python ready', busy: 'Running…' };
	const PLACEHOLDER = 'import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 10, 200)\nplt.plot(x, np.sin(x))   # figures, DataFrames, display(HTML(...)) render below';
</script>

<div class="flex h-full flex-col bg-zinc-50">
	<div class="flex items-center gap-1 border-b border-zinc-200 bg-white px-3 py-1.5">
		<button class="btn-ghost h-8 text-xs" title="Run every code cell from the top" onclick={runAll}>{@html icons.play} Run all</button>
		<button class="btn-ghost h-8 text-xs" title="Interrupt and restart Python (variables are cleared)" disabled={kernel.status === 'off'} class:opacity-40={kernel.status === 'off'} onclick={stop}>
			{@html kernel.status === 'busy' || kernel.status === 'loading' ? icons.stop : icons.restart}
			{kernel.status === 'busy' || kernel.status === 'loading' ? 'Stop' : 'Restart'}
		</button>
		{#if !readonly}
			<div class="mx-2 h-5 w-px bg-zinc-200"></div>
			<button class="btn-ghost h-8 text-xs" onclick={() => add('code')}>{@html icons.plus} Code</button>
			<button class="btn-ghost h-8 text-xs" onclick={() => add('md')}>{@html icons.plus} Text</button>
		{/if}
		<div class="flex-1"></div>
		<span class="hidden text-[11px] text-zinc-400 lg:inline">{#if readonly}View only — you can run the cells; results aren't saved{:else}<span class="kbd">⇧↵</span> run &amp; next · <span class="kbd">⌘↵</span> run · runs in your browser (Pyodide){/if}</span>
		<span class="ml-3 flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600">
			<span class="h-1.5 w-1.5 rounded-full {kernel.status === 'idle' ? 'bg-emerald-500' : kernel.status === 'off' ? 'bg-zinc-300' : 'animate-pulse bg-amber-500'}"></span>
			{statusText[kernel.status]}
		</span>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto flex max-w-4xl flex-col gap-1 px-6 py-6">
			{#each nb.cells as cell, i (cell.id)}
				<div class="group relative flex gap-2">
					<!-- gutter -->
					<div class="flex w-8 shrink-0 flex-col items-center pt-1.5">
						{#if cell.kind === 'code'}
							<button
								class="grid h-7 w-7 place-items-center rounded-full text-zinc-400 transition hover:bg-indigo-50 hover:text-indigo-600 {runState[cell.id] ? 'text-indigo-600' : ''}"
								title="Run cell (⇧↵)"
								onclick={() => run(cell.id)}
							>
								{#if runState[cell.id]}<span class="spin h-3.5 w-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-600" class:opacity-40={runState[cell.id] === 'queued'}></span>{:else}{@html icons.play}{/if}
							</button>
						{/if}
					</div>

					<div class="min-w-0 flex-1">
						<div class="relative rounded-lg border bg-white transition {cell.kind === 'code' ? 'border-zinc-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50' : 'border-transparent hover:border-zinc-200'}">
							{#if cell.kind === 'code'}
								<CodeInput
									bind:this={inputs[cell.id]}
									{readonly}
									value={cell.src}
									placeholder={i === 0 && nb.cells.length === 1 ? PLACEHOLDER : ''}
									onchange={(v) => ((cell.src = v), save())}
									onrun={(adv) => (adv ? runAndAdvance(cell.id) : run(cell.id))}
								/>
							{:else if editingMd === cell.id && !readonly}
								<div class="px-3">
									<CodeInput
										bind:this={inputs[cell.id]}
										lang="text"
										value={cell.src}
										placeholder="Markdown text — explain what the code shows"
										onchange={(v) => ((cell.src = v), save())}
										onrun={(adv) => (adv ? runAndAdvance(cell.id) : (editingMd = null))}
									/>
								</div>
							{:else}
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
								<div class="md min-h-9 cursor-text px-3 py-2 text-[14px]" ondblclick={async () => ((editingMd = cell.id), await tick(), inputs[cell.id]?.focus())} onclick={async () => ((editingMd = cell.id), await tick(), inputs[cell.id]?.focus())}>
									{#if cell.src.trim()}{@html renderMarkdown(cell.src, store.items)}{:else}<span class="text-zinc-400">Empty text cell — click to edit</span>{/if}
								</div>
							{/if}

							<div class:!hidden={readonly} class="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 shadow-sm group-hover:flex">
								<button class="icon-btn h-6 w-6 text-[13px]" title={cell.kind === 'code' ? 'Turn into text cell' : 'Turn into code cell'} onclick={() => toggleKind(cell)}>{@html cell.kind === 'code' ? icons.text : icons.code}</button>
								<button class="icon-btn h-6 w-6 text-[13px]" title="Move up" onclick={() => shift(cell.id, -1)}>{@html icons.up}</button>
								<button class="icon-btn h-6 w-6 text-[13px]" title="Move down" onclick={() => shift(cell.id, 1)}>{@html icons.down}</button>
								<button class="icon-btn h-6 w-6 text-[13px] hover:text-red-600" title="Delete cell" onclick={() => remove(cell.id)}>{@html icons.trash}</button>
							</div>
						</div>

						{#if logs[cell.id]}<div class="px-1 pt-1 text-[11px] text-zinc-400">{logs[cell.id]}</div>{/if}
						{#if cell.kind === 'code' && cell.outputs.length}
							<div class="flex flex-col gap-1.5 px-1 pt-2 pb-1">
								{#each cell.outputs as out, j (j)}<OutputView {out} />{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- insert between cells -->
				<div class="flex h-4 items-center justify-center gap-2 pl-10 opacity-0 transition hover:opacity-100">
					<div class="h-px flex-1 bg-zinc-200"></div>
					<button class="rounded px-1.5 text-[11px] text-zinc-500 hover:bg-zinc-200" onclick={() => add('code', i + 1)}>+ Code</button>
					<button class="rounded px-1.5 text-[11px] text-zinc-500 hover:bg-zinc-200" onclick={() => add('md', i + 1)}>+ Text</button>
					<div class="h-px flex-1 bg-zinc-200"></div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.spin { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
