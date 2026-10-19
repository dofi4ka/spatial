<script lang="ts">
	import type { Item } from '#lib/types.ts';
	import { fitSize, imageSize, type ProjectStore } from '#lib/store.svelte.ts';
	import { icons } from '#lib/icons.ts';

	let { store, item }: { store: ProjectStore; item: Item } = $props();
	let input: HTMLInputElement;
	let busy = $state(false);

	async function replace(file: File | undefined) {
		if (!file) return;
		busy = true;
		try {
			const [w, h] = fitSize(...(await imageSize(file)));
			const name = await store.upload(file);
			store.update(item.id, { content: name, w, h });
		} catch (e) {
			alert((e as Error).message);
		}
		busy = false;
	}
</script>

<div
	class="flex h-full flex-col bg-[conic-gradient(#f4f4f5_25%,#fff_0_50%,#f4f4f5_0_75%,#fff_0)] [background-size:20px_20px]"
	role="region"
	ondragover={(e) => e.preventDefault()}
	ondrop={(e) => {
		e.preventDefault();
		replace(e.dataTransfer?.files[0]);
	}}
>
	<div class="flex justify-center gap-2 p-3">
		<button class="btn" disabled={busy} onclick={() => input.click()}>{@html icons.upload} {busy ? 'Uploading…' : 'Replace image'}</button>
		{#if item.content}<a class="btn" href="/uploads/{item.content}" download={item.name}>{@html icons.download} Download</a>{/if}
	</div>
	<div class="grid min-h-0 flex-1 place-items-center p-6">
		{#if item.content}
			<img src="/uploads/{item.content}" alt={item.name} class="max-h-full max-w-full rounded-lg shadow-lg" />
		{:else}
			<div class="text-zinc-400">Drop an image here</div>
		{/if}
	</div>
	<input bind:this={input} type="file" accept="image/*" class="hidden" onchange={(e) => replace(e.currentTarget.files?.[0])} />
</div>
