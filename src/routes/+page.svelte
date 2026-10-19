<script lang="ts">
	import { enhance } from '$app/forms';
	import TopBar from '#lib/components/TopBar.svelte';

	let { data } = $props();
	let editing = $state<string | null>(null);
	const ago = (t: number) => {
		const s = (Date.now() - t) / 1000;
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return new Date(t).toLocaleDateString();
	};
</script>

<svelte:head><title>Projects · Spatial</title></svelte:head>

<div class="min-h-screen">
	<TopBar user={data.user!} />
	<main class="mx-auto max-w-5xl p-6">
		<div class="mb-6 flex items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold">Projects</h1>
				<p class="text-sm text-zinc-500">Shared with everyone on this workspace.</p>
			</div>
			<form method="POST" action="?/create" class="flex gap-2">
				<input name="name" placeholder="New project name" class="field w-60" />
				<button class="btn-primary">Create</button>
			</form>
		</div>

		{#if data.projects.length === 0}
			<div class="rounded-2xl border border-dashed border-zinc-300 p-16 text-center text-zinc-500">No projects yet. Create the first one.</div>
		{/if}

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.projects as p (p.id)}
				<div class="group relative rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm">
					<a href="/p/{p.id}" class="absolute inset-0" aria-label="Open {p.name}"></a>
					<div class="mb-8 h-20 rounded-xl bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:12px_12px]"></div>
					{#if editing === p.id}
						<form method="POST" action="?/rename" use:enhance={() => async ({ update }) => { editing = null; await update(); }} class="relative z-10">
							<input type="hidden" name="id" value={p.id} />
							<!-- svelte-ignore a11y_autofocus -->
							<input name="name" value={p.name} class="field-sm" autofocus onblur={(e) => e.currentTarget.form?.requestSubmit()} />
						</form>
					{:else}
						<div class="font-medium">{p.name}</div>
					{/if}
					<div class="text-xs text-zinc-500">{p.item_count} items · updated {ago(p.updated_at)}</div>
					<div class="absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
						<button class="btn-ghost text-xs" onclick={() => (editing = p.id)}>Rename</button>
						{#if data.user?.is_admin}
							<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm(`Delete project “${p.name}” and everything in it?`)) e.preventDefault(); }}>
								<input type="hidden" name="id" value={p.id} />
								<button class="btn-ghost text-xs text-red-600">Delete</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</main>
</div>
