<script lang="ts">
	import { enhance } from '$app/forms';
	import { icons } from '#lib/icons.ts';

	let { data, form } = $props();
	let isOwner = $derived(data.access === 'owner');
	const initials = (n: string) => n.slice(0, 2).toUpperCase();
</script>

<svelte:head><title>Settings · {data.project.name} · Spatial</title></svelte:head>

<div class="min-h-screen">
	<header class="flex h-12 items-center gap-2 border-b border-zinc-200 bg-white px-3">
		<a href="/" class="icon-btn" title="All projects"><span class="logo"></span></a>
		<a href="/p/{data.project.id}" class="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100">{data.project.name}</a>
		<span class="text-zinc-300">/</span>
		<span class="px-2 text-sm font-semibold">Settings</span>
		<div class="flex-1"></div>
		<a href="/p/{data.project.id}" class="btn">{@html icons.back} Back to project</a>
	</header>

	<main class="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
		<h1 class="text-2xl font-semibold">Project settings</h1>

		{#if form?.error}<div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</div>{/if}
		{#if form?.ok}<div class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{form.ok}</div>{/if}

		<form method="POST" action="?/general" use:enhance={() => async ({ update }) => update({ reset: false })} class="card">
			<h2 class="card-title">General</h2>
			<label><span class="label">Name</span><input name="name" required maxlength="120" value={data.project.name} class="field" /></label>
			<label>
				<span class="label">Description</span>
				<textarea name="description" maxlength="1000" rows="3" class="field resize-y" placeholder="What is this project about?">{data.project.description}</textarea>
			</label>
			<div class="flex justify-end"><button class="btn-primary">Save</button></div>
		</form>

		<form method="POST" action="?/visibility" use:enhance={() => async ({ update }) => update({ reset: false })} class="card">
			<h2 class="card-title">Visibility</h2>
			<fieldset class="flex flex-col gap-2 sm:flex-row" disabled={!isOwner}>
				<label class="vis-option">
					<input type="radio" name="visibility" value="private" checked={data.project.visibility === 'private'} />
					<span><b>{@html icons.lock} Private</b>Only the owner and members can see and edit it.</span>
				</label>
				<label class="vis-option">
					<input type="radio" name="visibility" value="public" checked={data.project.visibility === 'public'} />
					<span><b>{@html icons.globe} Public</b>Everyone on this workspace can see it. Only the owner and members can edit it.</span>
				</label>
			</fieldset>
			{#if isOwner}
				<div class="flex items-center justify-end gap-3">
					<span class="text-xs text-zinc-400">Making a project private also replaces its export link.</span>
					<button class="btn-primary">Update visibility</button>
				</div>
			{:else}
				<p class="text-xs text-zinc-400">Only the owner can change the visibility.</p>
			{/if}
		</form>

		<section class="card">
			<h2 class="card-title">People</h2>
			<p class="-mt-2 text-sm text-zinc-500">Members can see and edit everything in this project.</p>
			{#if isOwner}
				<form method="POST" action="?/add" use:enhance class="flex gap-2">
					<input name="email" type="email" required placeholder="Add a person by email" class="field" />
					<button class="btn-primary shrink-0">{@html icons.plus} Add</button>
				</form>
			{/if}
			<div class="overflow-hidden rounded-xl border border-zinc-200">
				{#if data.owner}
					<div class="person">
						<div class="avatar">{initials(data.owner.name)}</div>
						<div class="min-w-0 flex-1"><div class="font-medium">{data.owner.name}</div><div class="text-xs text-zinc-500">{data.owner.email}</div></div>
						<span class="text-xs font-medium text-zinc-500">Owner</span>
					</div>
				{/if}
				{#each data.members as m (m.id)}
					<div class="person">
						<div class="avatar">{initials(m.name)}</div>
						<div class="min-w-0 flex-1"><div class="font-medium">{m.name}{#if m.id === data.user?.id} <span class="text-zinc-400">(you)</span>{/if}</div><div class="text-xs text-zinc-500">{m.email}</div></div>
						<span class="text-xs text-zinc-500">Member</span>
						{#if isOwner || m.id === data.user?.id}
							<form method="POST" action="?/remove" use:enhance onsubmit={(e) => { if (!confirm(m.id === data.user?.id ? 'Leave this project?' : `Remove ${m.name} from this project?`)) e.preventDefault(); }}>
								<input type="hidden" name="id" value={m.id} />
								<button class="btn-ghost text-xs text-red-600">{m.id === data.user?.id ? 'Leave' : 'Remove'}</button>
							</form>
						{/if}
					</div>
				{:else}
					<div class="px-4 py-3 text-sm text-zinc-400">No members yet{isOwner ? ' — add someone by their email above.' : '.'}</div>
				{/each}
			</div>
		</section>

		{#if isOwner}
			<section class="card border-red-200">
				<h2 class="card-title text-red-700">Delete project</h2>
				<div class="flex items-center gap-4">
					<p class="flex-1 text-sm text-zinc-500">Deletes the project and everything in it for everyone. This cannot be undone.</p>
					<form method="POST" action="?/delete" onsubmit={(e) => { if (prompt(`Type the project name to delete it:\n${data.project.name}`) !== data.project.name) e.preventDefault(); }}>
						<button class="btn border-red-200 text-red-600 hover:bg-red-50">{@html icons.trash} Delete project</button>
					</form>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.card { display: flex; flex-direction: column; gap: 1rem; border-radius: 1rem; border: 1px solid #e4e4e7; background: white; padding: 1.25rem; }
	.card.border-red-200 { border-color: #fecaca; }
	.card-title { font-weight: 600; }
	.person { display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid #f4f4f5; padding: 0.6rem 1rem; font-size: 14px; }
	.person:last-child { border-bottom: 0; }
	.avatar { display: grid; place-items: center; width: 2rem; height: 2rem; flex-shrink: 0; border-radius: 999px; background: #e0e7ff; color: #4338ca; font-size: 11px; font-weight: 600; }
</style>
