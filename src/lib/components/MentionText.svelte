<script lang="ts">
	import { getContext } from 'svelte';
	import type { Item } from '#lib/types.ts';
	import { splitMentions } from '#lib/mentions.ts';

	let { text }: { text: string } = $props();
	const items = getContext<Record<string, Item> | undefined>('spatial:items') ?? {};
	let segs = $derived(splitMentions(text));
</script>

{#each segs as s}{#if s.t === 'text'}{s.v}{:else}{@const it = items[s.id]}<span class="mention" class:missing={!it}>@{it?.name ?? s.name}</span>{/if}{/each}
