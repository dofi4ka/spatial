<script lang="ts">
	import type { ProjectSummary } from '#lib/types.ts';
	import { icons } from '#lib/icons.ts';

	let { p, showOwner = true }: { p: ProjectSummary; showOwner?: boolean } = $props();

	const ago = (t: number) => {
		const s = (Date.now() - t) / 1000;
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return new Date(t).toLocaleDateString();
	};
</script>

<a href="/p/{p.id}" class="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm">
	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<div class="truncate font-medium text-zinc-900 group-hover:text-indigo-700">
				{#if showOwner && p.owner_name}<span class="font-normal text-zinc-500">{p.owner_name} / </span>{/if}{p.name}
			</div>
		</div>
		<span class="vis shrink-0 {p.visibility}">{@html p.visibility === 'public' ? icons.globe : icons.lock} {p.visibility === 'public' ? 'Public' : 'Private'}</span>
	</div>
	<p class="mt-1 line-clamp-2 min-h-10 text-sm text-zinc-500">{p.description || 'No description'}</p>
	<div class="mt-3 flex items-center gap-3 text-xs text-zinc-400">
		<span>{p.item_count} items</span>
		{#if p.member_count}<span class="flex items-center gap-1">{@html icons.users} {p.member_count}</span>{/if}
		<span class="ml-auto">updated {ago(p.updated_at)}</span>
	</div>
</a>
