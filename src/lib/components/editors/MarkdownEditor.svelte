<script lang="ts">
	import { onMount } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import type { ProjectStore } from '#lib/store.svelte.ts';
	import { markdownMention, SCHEME } from '#lib/mentions.ts';
	import { mentionSrc } from '#lib/markdown.ts';
	import { isVisual } from '#lib/drawing.ts';
	import MentionPicker from '../MentionPicker.svelte';

	let { store, item, onopen }: { store: ProjectStore; item: Item; onopen?: (item: Item) => void } = $props();

	let el: HTMLDivElement;
	let loading = $state(true);
	let lastLocal = item.content;
	let lastTyped = 0;
	let saveTimer: ReturnType<typeof setTimeout>;
	let applyRemote: ((md: string) => void) | null = null;
	let insertMarkdown: ((md: string, inline: boolean) => void) | null = null;
	let insertLink: ((text: string, href: string) => void) | null = null;
	let picker = $state<{ x: number; y: number; typed: boolean } | null>(null);

	/** Show current names for [@Name](#spatial:id) mentions (they may have been renamed since). */
	const freshNames = (md: string) =>
		md.replace(new RegExp(`\\[@([^\\]\\n]*)\\]\\(${SCHEME}([\\w-]+)\\)`, 'g'), (all, name, id) => {
			const it = store.items[id];
			return it ? markdownMention(it.name, id, false) : all;
		});

	onMount(() => {
		let crepe: import('@milkdown/crepe').Crepe | null = null;
		let destroyed = false;
		(async () => {
			const [{ Crepe }, { replaceAll, insert }, { editorViewCtx }, { TextSelection }] = await Promise.all([
				import('@milkdown/crepe'),
				import('@milkdown/kit/utils'),
				import('@milkdown/kit/core'),
				import('@milkdown/kit/prose/state'),
				import('@milkdown/crepe/theme/common/style.css'),
				import('@milkdown/crepe/theme/frame.css')
			]);
			if (destroyed) return;
			const upload = async (file: File) => `/uploads/${await store.upload(file)}`;
			crepe = new Crepe({
				root: el,
				defaultValue: freshNames(item.content),
				featureConfigs: {
					[Crepe.Feature.ImageBlock]: {
						onUpload: upload,
						inlineOnUpload: upload,
						blockOnUpload: upload,
						// mentioned images are stored as #spatial:<id>; show the actual upload
						proxyDomURL: (url: string) => (url.startsWith(SCHEME) ? mentionSrc(url.slice(SCHEME.length), store.items) : url)
					},
					[Crepe.Feature.Placeholder]: { text: 'Start writing, or type / for commands…' }
				}
			});
			crepe.on((l) =>
				l.markdownUpdated((_ctx, md) => {
					if (md === lastLocal) return;
					lastLocal = md;
					lastTyped = Date.now();
					clearTimeout(saveTimer);
					saveTimer = setTimeout(() => store.update(item.id, { content: md }), 400);
				})
			);
			await crepe.create();
			if (store.readonly) crepe.setReadonly(true);
			const c = crepe;
			applyRemote = (md) => {
				lastLocal = md;
				c.editor.action(replaceAll(md, true));
			};
			// insert "@Name" as a link mark, followed by an unlinked space so typing continues outside it
			insertLink = (text, href) => {
				c.editor.action((ctx) => {
					const view = ctx.get(editorViewCtx);
					const { schema } = view.state;
					const tr = view.state.tr.deleteSelection();
					let pos = tr.selection.from;
					const before = tr.doc.textBetween(Math.max(0, pos - 1), pos);
					if (before && !/\s/.test(before)) (tr.insertText(' ', pos), pos++);
					tr.insert(pos, schema.text(text, [schema.marks.link.create({ href })]));
					pos += text.length;
					tr.insert(pos, schema.text(' '));
					pos++;
					tr.setSelection(TextSelection.create(tr.doc, pos)).setStoredMarks([]);
					view.dispatch(tr);
					view.focus();
				});
			};
			insertMarkdown = (md, inline) => {
				c.editor.action((ctx) => {
					const view = ctx.get(editorViewCtx);
					if (md === '@') view.dispatch(view.state.tr.insertText('@'));
					else insert(md, inline)(ctx);
					view.focus();
				});
			};
			loading = false;
		})();
		return () => {
			destroyed = true;
			clearTimeout(saveTimer);
			if (crepe && lastLocal !== store.items[item.id]?.content) store.update(item.id, { content: lastLocal });
			crepe?.destroy();
		};
	});

	function caretRect() {
		const sel = window.getSelection();
		if (sel?.rangeCount) {
			const r = sel.getRangeAt(0).getBoundingClientRect();
			if (r.width || r.height || r.x) return { x: r.left, y: r.bottom + 6 };
		}
		const b = el.getBoundingClientRect();
		return { x: b.left + 80, y: b.top + 40 };
	}

	function onKeyDownCapture(e: KeyboardEvent) {
		if (e.key !== '@' || e.metaKey || e.ctrlKey || !insertMarkdown) return;
		if (!(e.target as HTMLElement).closest('.ProseMirror')) return;
		e.preventDefault();
		e.stopPropagation();
		picker = { ...caretRect(), typed: true };
	}

	function pick(it: Item) {
		picker = null;
		if (isVisual(it.type)) insertMarkdown?.(`\n${markdownMention(it.name, it.id, true)}\n`, false);
		else insertLink?.(`@${it.name}`, `${SCHEME}${it.id}`);
	}

	function closePicker() {
		const typed = picker?.typed;
		picker = null;
		if (typed) insertMarkdown?.('@', true);
	}

	// ⌘/Ctrl-click a mention to open the mentioned file
	function onClickCapture(e: MouseEvent) {
		const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(`a[href^="${SCHEME}"]`);
		if (!a) return;
		e.preventDefault();
		if (!(e.metaKey || e.ctrlKey)) return;
		e.stopPropagation();
		const it = store.items[a.getAttribute('href')!.slice(SCHEME.length)];
		if (it) onopen?.(it);
	}

	// Pull in edits made by others, unless we're mid-typing (then retry shortly).
	let retry: ReturnType<typeof setTimeout>;
	$effect(() => {
		const r = store.remote;
		if (!r || r.id !== item.id) return;
		const tryApply = () => {
			const content = store.items[item.id]?.content;
			if (content === undefined || content === lastLocal || !applyRemote) return;
			if (Date.now() - lastTyped < 1500) return void (retry = setTimeout(tryApply, 800));
			applyRemote(content);
		};
		clearTimeout(retry);
		tryApply();
	});
</script>

<div class="relative h-full overflow-auto bg-white">
	<div class="sticky top-0 z-10 flex justify-end px-4 pt-3" class:hidden={store.readonly}>
		<button
			class="btn text-xs shadow-sm"
			title="Mention a file (or type @ in the text). ⌘-click a mention to open it."
			onpointerdown={(e) => e.preventDefault()}
			onclick={(e) => {
				const r = e.currentTarget.getBoundingClientRect();
				picker = { x: r.right - 320, y: r.bottom + 6, typed: false };
			}}
		>
			<span class="font-semibold text-indigo-500">@</span> Mention file
		</button>
	</div>
	<div class="mx-auto max-w-4xl pb-8">
		{#if loading}<div class="p-10 text-center text-sm text-zinc-400">Loading editor…</div>{/if}
		<div bind:this={el} class="crepe-host" role="presentation" onkeydowncapture={onKeyDownCapture} onclickcapture={onClickCapture}></div>
	</div>
	<div class="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-zinc-400" class:hidden={store.readonly}>
		Type <span class="kbd">@</span> to mention a file · <span class="kbd">⌘</span>-click a mention to open it
	</div>
</div>

{#if picker}
	<MentionPicker {store} x={picker.x} y={picker.y} exclude={item.id} onpick={pick} onclose={closePicker} />
{/if}

<style>
	.crepe-host :global(.milkdown) {
		--crepe-font-default: Inter, ui-sans-serif, system-ui, sans-serif;
		--crepe-font-title: Inter, ui-sans-serif, system-ui, sans-serif;
		--crepe-font-code: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.crepe-host :global(.milkdown .ProseMirror) { padding: 24px 80px 120px; min-height: 60vh; }
</style>
