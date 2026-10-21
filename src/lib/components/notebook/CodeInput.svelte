<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState, Prec } from '@codemirror/state';
	import { EditorView, keymap, placeholder as cmPlaceholder, lineNumbers, drawSelection, highlightActiveLine } from '@codemirror/view';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { bracketMatching, defaultHighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
	import { python } from '@codemirror/lang-python';

	let {
		value,
		lang = 'python',
		placeholder = '',
		readonly = false,
		onchange,
		onrun,
		onfocus
	}: {
		value: string;
		lang?: 'python' | 'text';
		placeholder?: string;
		readonly?: boolean;
		onchange: (v: string) => void;
		/** Mod-Enter → run; Shift-Enter → run and move on */
		onrun?: (advance: boolean) => void;
		onfocus?: () => void;
	} = $props();

	let host: HTMLDivElement;
	let view: EditorView;

	export function focus() {
		view?.focus();
	}

	onMount(() => {
		view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: value,
				extensions: [
					Prec.highest(
						keymap.of([
							{ key: 'Shift-Enter', run: () => (onrun?.(true), true) },
							{ key: 'Mod-Enter', run: () => (onrun?.(false), true) },
							{ key: 'Escape', run: (v) => (v.contentDOM.blur(), true) }
						])
					),
					EditorState.readOnly.of(readonly),
					history(),
					drawSelection(),
					keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
					indentUnit.of('    '),
					EditorState.tabSize.of(4),
					lang === 'python' ? [python(), lineNumbers(), indentOnInput(), bracketMatching(), syntaxHighlighting(defaultHighlightStyle, { fallback: true })] : EditorView.lineWrapping,
					highlightActiveLine(),
					cmPlaceholder(placeholder),
					EditorView.updateListener.of((u) => {
						if (u.docChanged) onchange(u.state.doc.toString());
						if (u.focusChanged && u.view.hasFocus) onfocus?.();
					}),
					EditorView.theme({
						'&': { fontSize: lang === 'python' ? '12.5px' : '13.5px', background: 'transparent' },
						'&.cm-focused': { outline: 'none' },
						'.cm-content': { fontFamily: lang === 'python' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', padding: '8px 0' },
						'.cm-gutters': { background: 'transparent', border: 'none', color: '#a1a1aa' },
						'.cm-activeLine, .cm-activeLineGutter': { background: 'transparent' },
						'&.cm-focused .cm-activeLine': { background: 'rgba(99,102,241,0.05)' }
					})
				]
			})
		});
		return () => view.destroy();
	});

	// remote edits: replace the document unless the user is typing in it
	$effect(() => {
		const v = value;
		if (view && !view.hasFocus && v !== view.state.doc.toString()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
	});
</script>

<div bind:this={host} class="min-w-0"></div>
