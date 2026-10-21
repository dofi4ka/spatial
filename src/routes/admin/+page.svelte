<script lang="ts">
	import { enhance } from '$app/forms';
	import TopBar from '#lib/components/TopBar.svelte';
	import AdminNav from '#lib/components/AdminNav.svelte';
	let { data, form } = $props();
	let pwFor = $state<string | null>(null);
</script>

<svelte:head><title>Admin · Spatial</title></svelte:head>

<div class="min-h-screen">
	<TopBar user={data.user!}><span class="text-zinc-300">/</span><span class="text-sm">Admin</span></TopBar>
	<main class="mx-auto max-w-5xl p-6">
		<AdminNav />
		<h1 class="mb-1 text-2xl font-semibold">Users</h1>
		<p class="mb-6 text-sm text-zinc-500">There is no public sign-up. Each user has their own projects and sees public projects of others; owners add people to their projects.</p>

		{#if form?.error}<div class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</div>{/if}
		{#if form?.ok}<div class="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{form.ok}</div>{/if}

		<form method="POST" action="?/create" use:enhance class="mb-8 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end">
			<label><span class="label">Email</span><input name="email" type="email" required class="field" /></label>
			<label><span class="label">Name</span><input name="name" class="field" /></label>
			<label><span class="label">Password</span><input name="password" type="text" required minlength="6" class="field" autocomplete="off" /></label>
			<label class="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="is_admin" /> Admin</label>
			<button class="btn-primary">Add user</button>
		</form>

		<div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
			{#each data.users as u (u.id)}
				<div class="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0">
					<div class="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{u.name.slice(0, 2).toUpperCase()}</div>
					<div class="min-w-0 flex-1">
						<div class="font-medium">{u.name} {#if u.is_admin}<span class="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">ADMIN</span>{/if}</div>
						<div class="text-xs text-zinc-500">{u.email}{#if u.env_admin} · configured via env{/if} · {u.projects} project{u.projects === 1 ? '' : 's'}</div>
					</div>
					{#if !u.env_admin}
						{#if pwFor === u.id}
							<form method="POST" action="?/password" use:enhance={() => async ({ update }) => { pwFor = null; await update(); }} class="flex gap-2">
								<input type="hidden" name="id" value={u.id} />
								<input name="password" placeholder="New password" minlength="6" required class="field-sm w-40" />
								<button class="btn text-xs">Save</button>
							</form>
						{:else}
							<button class="btn-ghost text-xs" onclick={() => (pwFor = u.id)}>Reset password</button>
						{/if}
						{#if u.id !== data.user?.id}
							<form method="POST" action="?/admin" use:enhance>
								<input type="hidden" name="id" value={u.id} />
								<input type="hidden" name="value" value={u.is_admin ? '0' : '1'} />
								<button class="btn-ghost text-xs">{u.is_admin ? 'Remove admin' : 'Make admin'}</button>
							</form>
							<form method="POST" action="?/delete" use:enhance onsubmit={(e) => { if (!confirm(`Delete ${u.email}?${u.projects ? `\n\nTheir ${u.projects} project(s) will be transferred to you.` : ''}`)) e.preventDefault(); }}>
								<input type="hidden" name="id" value={u.id} />
								<button class="btn-ghost text-xs text-red-600">Delete</button>
							</form>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	</main>
</div>
