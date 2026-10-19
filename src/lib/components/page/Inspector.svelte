<script lang="ts">
	import { findParent, SPACING, type Layout } from '#lib/page.ts';
	import { icons } from '#lib/icons.ts';
	import { tick } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { mentionToken, splitMentions } from '#lib/mentions.ts';
	import { visualSrc } from '#lib/drawing.ts';
	import type { PageEditorState } from './editor.svelte';
	import MentionPicker from '../MentionPicker.svelte';

	let { ed, store, pageId, onopen }: { ed: PageEditorState; store: ProjectStore; pageId: string; onopen?: (item: Item) => void } = $props();
	let textEl = $state<HTMLTextAreaElement>();
	let picker = $state<{ x: number; y: number; field: 'prompt' | 'text'; start: number; end: number; typed: boolean } | null>(null);

	function openPicker(field: 'prompt' | 'text', typed: boolean) {
		const el = field === 'prompt' ? promptEl : textEl;
		if (!el) return;
		const r = el.getBoundingClientRect();
		picker = { x: r.left, y: r.bottom + 4, field, start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length, typed };
	}

	async function insertAt(text: string) {
		const p = picker;
		const n = node;
		picker = null;
		if (!p || !n) return;
		const cur = n[p.field];
		const pad = text !== '@' && p.start > 0 && !/\s$/.test(cur.slice(0, p.start)) ? ' ' : '';
		const ins = pad + text + (text !== '@' ? ' ' : '');
		set(p.field, cur.slice(0, p.start) + ins + cur.slice(p.end));
		await tick();
		const el = p.field === 'prompt' ? promptEl : textEl;
		el?.focus();
		el?.setSelectionRange(p.start + ins.length, p.start + ins.length);
	}

	function onFieldKey(field: 'prompt' | 'text', e: KeyboardEvent) {
		if (e.key === '@' && !e.metaKey && !e.ctrlKey) {
			e.preventDefault();
			openPicker(field, true);
		}
	}

	function removeMention(field: 'prompt' | 'text', id: string) {
		const n = node;
		if (!n) return;
		set(field, n[field].replace(new RegExp(`\\s?@\\[[^\\]\\n]*\\]\\(#spatial:${id}\\)`, 'g'), ''));
	}

	let node = $derived(ed.selected);
	let isRoot = $derived(node?.id === ed.root.id);
	let promptEl = $state<HTMLTextAreaElement>();

	$effect(() => {
		if (ed.focusPrompt && promptEl) {
			promptEl.focus();
			promptEl.select();
		}
	});

	const TAGS = ['div', 'section', 'header', 'footer', 'main', 'nav', 'aside', 'article', 'form', 'button', 'a', 'input', 'textarea', 'select', 'label', 'img', 'video', 'svg', 'h1', 'h2', 'h3', 'h4', 'p', 'span', 'strong', 'small', 'ul', 'ol', 'li', 'table', 'dialog', 'details', 'figure', 'blockquote', 'pre', 'code', 'hr'];
	const QUICK = ['div', 'section', 'button', 'a', 'input', 'img', 'h1', 'h2', 'p', 'span', 'ul', 'li'];

	function set<K extends 'tag' | 'prompt' | 'text'>(k: K, v: string) {
		const n = node;
		if (!n) return;
		ed.mutate(() => (n[k] = v), `${n.id}:${k}`);
	}
	function setL<K extends keyof Layout>(k: K, v: Layout[K]) {
		const n = node;
		if (!n) return;
		ed.mutate(() => (n.layout[k] = v));
	}
</script>

{#snippet mentions(field: 'prompt' | 'text', value: string)}
	{@const ms = splitMentions(value).filter((s) => s.t === 'mention')}
	{#if ms.length}
		<div class="mt-1.5 flex flex-wrap gap-1">
			{#each ms as m}
				{#if m.t === 'mention'}
					{@const it = store.items[m.id]}
					<span class="mention {it ? '' : 'missing'} inline-flex items-center gap-1 text-[11px]">
						{#if visualSrc(it)}<img src={visualSrc(it)} alt="" class="h-3.5 w-3.5 rounded-sm object-cover" />{/if}
						<button class="hover:underline" title={it ? 'Open' : 'This file was deleted'} onclick={() => it && onopen?.(it)}>@{it?.name ?? m.name}</button>
						<button class="opacity-50 hover:opacity-100" title="Remove mention" onclick={() => removeMention(field, m.id)}>×</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}
{/snippet}

{#if picker}
	<MentionPicker
		{store}
		x={picker.x}
		y={picker.y}
		exclude={pageId}
		onpick={(it) => insertAt(mentionToken(it.name, it.id))}
		onclose={() => (picker?.typed ? insertAt('@') : (picker = null))}
	/>
{/if}

{#if !node}
	<div class="p-6 text-center text-sm text-zinc-400">
		Select an element on the page to describe it.<br /><br />
		<span class="text-xs">Tip: double-click an element to jump straight to its prompt.</span>
	</div>
{:else}
	{@const l = node.layout}
	<div class="flex flex-col gap-4 p-3">
		<div class="flex items-center gap-1">
			<span class="flex-1 truncate text-xs font-semibold text-zinc-500">{isRoot ? 'Page (body)' : `<${node.tag}>`}</span>
			{#if !isRoot}
				<button class="icon-btn h-7 w-7" title="Select parent (Esc)" onclick={() => (ed.selectedId = findParent(ed.root, node.id)?.id ?? null)}>{@html icons.parent}</button>
				<button class="icon-btn h-7 w-7" title="Move up (Alt+↑)" onclick={() => ed.shift(node.id, -1)}>{@html icons.up}</button>
				<button class="icon-btn h-7 w-7" title="Move down (Alt+↓)" onclick={() => ed.shift(node.id, 1)}>{@html icons.down}</button>
				<button class="icon-btn h-7 w-7" title="Wrap in container (⌘G)" onclick={() => ed.wrap(node.id)}>{@html icons.wrap}</button>
				<button class="icon-btn h-7 w-7" title="Duplicate (⌘D)" onclick={() => ed.duplicate(node.id)}>{@html icons.copy}</button>
				<button class="icon-btn h-7 w-7 hover:text-red-600" title="Delete (⌫)" onclick={() => ed.remove(node.id)}>{@html icons.trash}</button>
			{/if}
		</div>

		{#if !isRoot}
			<div>
				<span class="label">Tag</span>
				<input class="field-sm font-mono" list="tag-list" value={node.tag} oninput={(e) => set('tag', e.currentTarget.value.trim() || 'div')} />
				<datalist id="tag-list">{#each TAGS as t}<option value={t}></option>{/each}</datalist>
				<div class="mt-1.5 flex flex-wrap gap-1">
					{#each QUICK as t}
						<button class="rounded px-1.5 py-0.5 font-mono text-[10px] {node.tag === t ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}" onclick={() => set('tag', t)}>{t}</button>
					{/each}
				</div>
			</div>
		{/if}

		<div>
			<span class="label flex items-center gap-1">
				{@html icons.sparkle} Prompt
				<button class="ml-auto normal-case tracking-normal text-indigo-600 hover:underline" onclick={() => openPicker('prompt', false)}>@ mention file</button>
			</span>
			<textarea
				bind:this={promptEl}
				onkeydown={(e) => onFieldKey('prompt', e)}
				class="field-sm min-h-28 resize-y text-[13px] leading-snug"
				placeholder={isRoot ? 'Describe the whole page: purpose, audience, tone…' : 'Describe what this element should be, e.g. “primary”, or “pricing card for the Pro plan, highlighted as most popular”'}
				value={node.prompt}
				oninput={(e) => set('prompt', e.currentTarget.value)}
			></textarea>
			{@render mentions('prompt', node.prompt)}
			<p class="mt-1 text-[11px] text-zinc-400">Exported as an HTML comment inside the element. Type <span class="kbd">@</span> to mention a file — it becomes a relative path on export.</p>
		</div>

		{#if !isRoot}
			<div>
				<span class="label flex items-center gap-1">
					{@html icons.text} Text
					<button class="ml-auto normal-case tracking-normal text-indigo-600 hover:underline" onclick={() => openPicker('text', false)}>@ mention file</button>
				</span>
				<textarea
					bind:this={textEl}
					onkeydown={(e) => onFieldKey('text', e)}
					class="field-sm min-h-9 resize-y text-[13px]"
					rows="1"
					placeholder={node.tag === 'input' ? 'Placeholder text' : node.tag === 'img' ? 'Alt text' : 'Literal text content (labels, headings…)'}
					value={node.text}
					oninput={(e) => set('text', e.currentTarget.value)}
				></textarea>
				{@render mentions('text', node.text)}
				{#if node.tag === 'img' || node.tag === 'a'}
					<p class="mt-1 text-[11px] text-zinc-400">The first mentioned {node.tag === 'img' ? 'image' : 'file'} becomes this element's <code>{node.tag === 'img' ? 'src' : 'href'}</code>.</p>
				{/if}
			</div>
		{/if}

		<div class="flex flex-col gap-2.5 border-t border-zinc-100 pt-3">
			<div class="flex items-center justify-between">
				<span class="label mb-0">Auto layout <span class="normal-case">(children)</span></span>
				{#if !isRoot}<button class="text-[11px] text-indigo-600 hover:underline" onclick={() => ed.addChild(node.id)}>+ Add child</button>{/if}
			</div>
			<div class="seg">
				<button class:on={l.dir === 'col'} onclick={() => setL('dir', 'col')} title="Vertical stack">↓ Column</button>
				<button class:on={l.dir === 'row'} onclick={() => setL('dir', 'row')} title="Horizontal stack">→ Row</button>
				<button class:on={l.dir === 'grid'} onclick={() => setL('dir', 'grid')} title="Grid">▦ Grid</button>
			</div>
			{#if l.dir === 'grid'}
				<label class="flex items-center justify-between gap-2 text-xs text-zinc-600">
					Columns
					<div class="seg w-40">
						{#each [1, 2, 3, 4, 5, 6] as n}<button class:on={l.cols === n} onclick={() => setL('cols', n)}>{n}</button>{/each}
					</div>
				</label>
			{:else}
				<label class="flex items-center gap-2 text-xs text-zinc-600">
					<input type="checkbox" checked={l.wrap} onchange={(e) => setL('wrap', e.currentTarget.checked)} /> Wrap children
				</label>
			{/if}
			<div class="grid grid-cols-2 gap-2">
				<label class="text-xs text-zinc-600">
					Gap
					<select class="field-sm mt-0.5" value={l.gap} onchange={(e) => setL('gap', +e.currentTarget.value)}>
						{#each SPACING as s}<option value={s}>{s} · {s * 4}px</option>{/each}
					</select>
				</label>
				<label class="text-xs text-zinc-600">
					Padding
					<select class="field-sm mt-0.5" value={l.pad} onchange={(e) => setL('pad', +e.currentTarget.value)}>
						{#each SPACING as s}<option value={s}>{s} · {s * 4}px</option>{/each}
					</select>
				</label>
			</div>
			<div>
				<span class="mb-0.5 block text-xs text-zinc-600">Align (cross axis)</span>
				<div class="seg">
					{#each ['start', 'center', 'end', 'stretch'] as const as a}<button class:on={l.align === a} onclick={() => setL('align', a)}>{a}</button>{/each}
				</div>
			</div>
			<div>
				<span class="mb-0.5 block text-xs text-zinc-600">Justify (main axis)</span>
				<div class="seg">
					{#each ['start', 'center', 'end', 'between', 'around'] as const as j}<button class:on={l.justify === j} onclick={() => setL('justify', j)}>{j}</button>{/each}
				</div>
			</div>
		</div>

		{#if !isRoot}
			<div class="flex flex-col gap-2.5 border-t border-zinc-100 pt-3">
				<span class="label mb-0">Sizing (in parent)</span>
				{#each [['w', 'Width'], ['h', 'Height']] as const as [k, label]}
					<div class="flex items-center justify-between gap-2 text-xs text-zinc-600">
						{label}
						<div class="seg w-44">
							{#each [['auto', 'Auto'], ['hug', 'Hug'], ['fill', 'Fill']] as const as [v, t]}<button class:on={l[k] === v} onclick={() => setL(k, v)}>{t}</button>{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
