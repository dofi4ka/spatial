<script lang="ts">
	import TopBar from '#lib/components/TopBar.svelte';
	import ProjectCard from '#lib/components/projects/ProjectCard.svelte';
	import { icons } from '#lib/icons.ts';

	let { data } = $props();
	let creating = $state(false);
</script>

<svelte:head><title>Projects · Spatial</title></svelte:head>

{#snippet section(title: string, hint: string, list: typeof data.owned, showOwner: boolean)}
	<section class="mb-10">
		<div class="mb-3">
			<h2 class="text-base font-semibold">{title} <span class="font-normal text-zinc-400">{list.length}</span></h2>
			<p class="text-sm text-zinc-500">{hint}</p>
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each list as p (p.id)}<ProjectCard {p} {showOwner} />{/each}
		</div>
	</section>
{/snippet}

<div class="min-h-screen">
	<TopBar user={data.user!} />
	<main class="mx-auto max-w-5xl p-6">
		<div class="mb-8 flex items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold">Projects</h1>
				<p class="text-sm text-zinc-500">Your projects, projects you were added to, and public projects of others.</p>
			</div>
			{#if !creating}<button class="btn-primary" onclick={() => (creating = true)}>{@html icons.plus} New project</button>{/if}
		</div>

		{#if creating}
			<form method="POST" action="?/create" class="mb-10 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
				<label>
					<span class="label">Name</span>
					<!-- svelte-ignore a11y_autofocus -->
					<input name="name" required maxlength="120" class="field" placeholder="e.g. Checkout redesign" autofocus />
				</label>
				<label>
					<span class="label">Description <span class="normal-case tracking-normal text-zinc-400">(optional)</span></span>
					<textarea name="description" maxlength="1000" rows="2" class="field resize-y" placeholder="What is this project about?"></textarea>
				</label>
				<fieldset class="flex flex-col gap-2 sm:flex-row">
					<label class="vis-option">
						<input type="radio" name="visibility" value="private" checked />
						<span><b>{@html icons.lock} Private</b>Only you and the people you add can see and edit it.</span>
					</label>
					<label class="vis-option">
						<input type="radio" name="visibility" value="public" />
						<span><b>{@html icons.globe} Public</b>Every signed-in user can see it. Only you and the people you add can edit it.</span>
					</label>
				</fieldset>
				<div class="flex justify-end gap-2">
					<button type="button" class="btn" onclick={() => (creating = false)}>Cancel</button>
					<button class="btn-primary">Create project</button>
				</div>
			</form>
		{/if}

		{#if !data.owned.length && !data.shared.length && !creating}
			<div class="mb-10 rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500">
				You don't have any projects yet.
				<button class="ml-1 text-indigo-600 hover:underline" onclick={() => (creating = true)}>Create one</button>
			</div>
		{/if}

		{#if data.owned.length}{@render section('Your projects', 'Projects you own.', data.owned, false)}{/if}
		{#if data.shared.length}{@render section('Shared with you', 'Projects other people added you to. You can view and edit them.', data.shared, true)}{/if}
		{#if data.discover.length}{@render section('Public', 'Public projects of others. You can view them; ask the owner to add you to edit.', data.discover, true)}{/if}
	</main>
</div>
