<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Create account · Spatial</title></svelte:head>

<div class="grid min-h-screen place-items-center bg-zinc-50 p-4">
	<form method="POST" use:enhance class="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
		<div class="mb-6 flex items-center gap-2">
			<div class="logo"></div>
			<h1 class="text-lg font-semibold">Create your Spatial account</h1>
		</div>
		<label class="mb-3 block">
			<span class="mb-1 block text-xs font-medium text-zinc-500">Name</span>
			<input name="name" value={form?.name ?? ''} class="field" autocomplete="name" placeholder="How others see you" />
		</label>
		<label class="mb-3 block">
			<span class="mb-1 block text-xs font-medium text-zinc-500">Email</span>
			<input name="email" type="email" required value={form?.email ?? ''} class="field" autocomplete="email" />
		</label>
		<label class="mb-5 block">
			<span class="mb-1 block text-xs font-medium text-zinc-500">Password</span>
			<input name="password" type="password" required minlength="8" class="field" autocomplete="new-password" />
		</label>
		{#if form?.error}<p class="mb-3 text-sm text-red-600">{form.error}</p>{/if}
		<button class="btn-primary w-full">Create account</button>
		<p class="mt-4 text-center text-xs text-zinc-500">Already have an account? <a href="/login" class="text-indigo-600 hover:underline">Sign in</a></p>
	</form>
</div>
