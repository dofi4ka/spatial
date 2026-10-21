<script lang="ts">
	import { page } from '$app/state';
	const tabs = [
		['/admin', 'Users'],
		['/admin/projects', 'Projects']
	];
</script>

<nav class="mb-6 flex gap-1 border-b border-zinc-200">
	{#each tabs as [href, label]}
		<a {href} class="-mb-px border-b-2 px-3 py-2 text-sm font-medium {page.url.pathname === href ? 'border-indigo-600 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'}">{label}</a>
	{/each}
</nav>
