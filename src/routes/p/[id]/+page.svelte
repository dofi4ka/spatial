<script lang="ts">
	import Workspace from '#lib/components/Workspace.svelte';
	let { data } = $props();
</script>

{#key data.project.id}
	<Workspace project={data.project} items={data.items} user={data.user!} />
{/key}
