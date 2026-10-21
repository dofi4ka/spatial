<script lang="ts">
	import type { Output } from '#lib/notebook.ts';

	let { out }: { out: Output } = $props();

	let frame = $state<HTMLIFrameElement>();
	let height = $state(40);

	// HTML output runs in a sandboxed frame (no access to the app); it reports its height back.
	const srcdoc = (html: string) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:13px/1.45 ui-sans-serif,system-ui,sans-serif;color:#27272a;overflow:hidden}
table{border-collapse:collapse;font-variant-numeric:tabular-nums}td,th{border:1px solid #e4e4e7;padding:2px 8px;text-align:right}th{background:#f4f4f5}
</style>${html}<script>const p=()=>parent.postMessage({h:document.documentElement.scrollHeight},'*');new ResizeObserver(p).observe(document.documentElement);addEventListener('load',p);p()<\/script>`;

	$effect(() => {
		const f = frame;
		if (!f) return;
		const onMsg = (e: MessageEvent) => {
			if (e.source === f.contentWindow && typeof e.data?.h === 'number') height = Math.min(Math.max(e.data.h, 16), 2000);
		};
		window.addEventListener('message', onMsg);
		return () => window.removeEventListener('message', onMsg);
	});
</script>

{#if out.t === 'image'}
	<img src={out.v} alt="" class="max-w-full" />
{:else if out.t === 'svg'}
	<img src="data:image/svg+xml;charset=utf-8,{encodeURIComponent(out.v)}" alt="" class="max-w-full" />
{:else if out.t === 'html'}
	<iframe bind:this={frame} title="output" sandbox="allow-scripts" srcdoc={srcdoc(out.v)} class="block w-full border-0" style="height:{height}px"></iframe>
{:else}
	<pre class="out {out.t}">{out.v}</pre>
{/if}

<style>
	.out { margin: 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #27272a; }
	.out.stderr { color: #b45309; }
	.out.error { color: #b91c1c; background: #fef2f2; border-radius: 6px; padding: 6px 8px; }
	.out.result { color: #4338ca; }
</style>
