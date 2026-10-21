<script lang="ts">
	import { enhance } from '$app/forms';
	import TopBar from '#lib/components/TopBar.svelte';
	import AdminNav from '#lib/components/AdminNav.svelte';
	import { icons } from '#lib/icons.ts';

	let { data } = $props();
	let q = $state('');
	let filter = $state<'all' | 'public' | 'private'>('all');
	let list = $derived(
		data.projects.filter(
			(p) =>
				(filter === 'all' || p.visibility === filter) &&
				(!q.trim() || `${p.name} ${p.owner_name ?? ''} ${p.description}`.toLowerCase().includes(q.trim().toLowerCase()))
		)
	);
</script>

<svelte:head><title>Projects · Admin · Spatial</title></svelte:head>

<div class="min-h-screen">
	<TopBar user={data.user!}><span class="text-zinc-300">/</span><span class="text-sm">Admin</span></TopBar>
	<main class="mx-auto max-w-5xl p-6">
		<AdminNav />
		<div class="mb-4 flex flex-wrap items-end gap-3">
			<div class="flex-1">
				<h1 class="text-2xl font-semibold">All projects <span class="font-normal text-zinc-400">{data.projects.length}</span></h1>
				<p class="text-sm text-zinc-500">Admins can open any project read-only. To edit one, ask its owner to add you.</p>
			</div>
			<div class="seg w-56">
				{#each ['all', 'public', 'private'] as const as f}<button class:on={filter === f} onclick={() => (filter = f)}>{f[0].toUpperCase() + f.slice(1)}</button>{/each}
			</div>
			<input bind:value={q} placeholder="Search name, owner, description" class="field w-64" />
		</div>

		<div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
			<div class="grid grid-cols-[1fr_10rem_6rem_5rem_7rem_4rem] gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
				<span>Project</span><span>Owner</span><span>Visibility</span><span>Members</span><span>Updated</span><span></span>
			</div>
			{#each list as p (p.id)}
				<div class="grid grid-cols-[1fr_10rem_6rem_5rem_7rem_4rem] items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm last:border-0">
					<a href="/p/{p.id}" class="min-w-0">
						<div class="truncate font-medium hover:text-indigo-700">{p.name}</div>
						<div class="truncate text-xs text-zinc-500">{p.description || `${p.item_count} items`}</div>
					</a>
					<span class="truncate text-zinc-600">{p.owner_name ?? '—'}</span>
					<span><span class="vis {p.visibility}">{@html p.visibility === 'public' ? icons.globe : icons.lock} {p.visibility}</span></span>
					<span class="text-zinc-600 tabular-nums">{p.member_count}</span>
					<span class="text-xs text-zinc-500">{new Date(p.updated_at).toLocaleDateString()}</span>
					<form method="POST" action="?/delete" use:enhance class="text-right" onsubmit={(e) => { if (!confirm(`Delete “${p.name}” (owned by ${p.owner_name ?? 'nobody'}) and everything in it?`)) e.preventDefault(); }}>
						<input type="hidden" name="id" value={p.id} />
						<button class="icon-btn ml-auto h-7 w-7 hover:text-red-600" title="Delete project">{@html icons.trash}</button>
					</form>
				</div>
			{:else}
				<div class="p-8 text-center text-sm text-zinc-400">No projects match.</div>
			{/each}
		</div>
	</main>
</div>
