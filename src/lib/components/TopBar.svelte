<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { User } from '#lib/types.ts';
	let { user, children }: { user: User; children?: Snippet } = $props();
</script>

<header class="flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4">
	<a href="/" class="flex items-center gap-2 font-semibold"><span class="logo"></span>Spatial</a>
	<div class="flex flex-1 items-center gap-2">{@render children?.()}</div>
	{#if user.is_admin}<a href="/admin" class="btn-ghost">Admin</a>{/if}
	<span class="text-sm text-zinc-500">{user.name}</span>
	<form method="POST" action="/logout"><button class="btn-ghost">Sign out</button></form>
</header>
