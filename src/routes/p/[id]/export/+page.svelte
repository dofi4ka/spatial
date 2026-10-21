<script lang="ts">
	import { enhance } from '$app/forms';
	import { icons } from '#lib/icons.ts';

	let { data } = $props();

	let base = $derived(`${data.origin}/export/${data.token}`);
	let once = $derived(`# once: teach your coding agent how to read .spatial/ (appends to AGENTS.md)\ncurl -fsSL "${base}/AGENTS.md" >> AGENTS.md`);
	let every = $derived(
		`# every time the spec changes: replace .spatial/ with the latest export and commit it\ncurl -fsSL "${base}/spatial.tar.gz" -o .spatial.tgz \\\n  && rm -rf .spatial && tar -xzf .spatial.tgz && rm .spatial.tgz\ngit add .spatial && git commit -m "docs: update project's spatial"`
	);
	let copied = $state<string | null>(null);

	async function copy(key: string, text: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => copied === key && (copied = null), 1500);
	}

	const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
</script>

<svelte:head><title>Export · {data.project.name} · Spatial</title></svelte:head>

{#snippet block(key: string, code: string)}
	<div class="group relative">
		<pre class="overflow-x-auto rounded-xl bg-zinc-950 p-4 pr-24 font-mono text-[12.5px] leading-relaxed whitespace-pre text-zinc-200">{#each code.split('\n') as line}<span class={line.startsWith('#') ? 'text-zinc-500' : ''}>{line}</span>{'\n'}{/each}</pre>
		<button class="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700" onclick={() => copy(key, code)}>
			{@html icons.copy}{copied === key ? 'Copied' : 'Copy'}
		</button>
	</div>
{/snippet}

<div class="min-h-screen">
	<header class="flex h-12 items-center gap-2 border-b border-zinc-200 bg-white px-3">
		<a href="/" class="icon-btn" title="All projects"><span class="logo"></span></a>
		<a href="/p/{data.project.id}" class="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100">{data.project.name}</a>
		<span class="text-zinc-300">/</span>
		<span class="px-2 text-sm font-semibold">Export</span>
		<div class="flex-1"></div>
		<a href="/p/{data.project.id}" class="btn">{@html icons.back} Back to project</a>
	</header>

	<main class="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
		<div>
			<h1 class="text-2xl font-semibold">Export to your repository</h1>
			<p class="mt-1 text-sm text-zinc-500">
				Keep the spec versioned next to the code in a <code class="rounded bg-zinc-100 px-1">.spatial/</code> folder. Each export is a commit, so your coding agent can read the diff and implement just what changed — then you only tell it “build”, “implement” or “update”.
			</p>
		</div>

		<section class="flex flex-col gap-3">
			<h2 class="flex items-center gap-2 font-semibold"><span class="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-xs text-white">1</span> Once per repository</h2>
			<p class="text-sm text-zinc-600">Adds instructions for coding agents: what the files in <code class="rounded bg-zinc-100 px-1">.spatial/</code> mean and how to implement changes. Using Claude Code? Add <code class="rounded bg-zinc-100 px-1">@AGENTS.md</code> to your <code class="rounded bg-zinc-100 px-1">CLAUDE.md</code>, or append to <code class="rounded bg-zinc-100 px-1">CLAUDE.md</code> directly.</p>
			{@render block('once', once)}
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="flex items-center gap-2 font-semibold"><span class="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-xs text-white">2</span> Every time you update the spec</h2>
			<p class="text-sm text-zinc-600">Run from the repository root. Files deleted in Spatial disappear from <code class="rounded bg-zinc-100 px-1">.spatial/</code> too.</p>
			{@render block('every', every)}
		</section>

		<section class="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
			<div class="flex items-center gap-3">
				<div class="flex-1 text-zinc-600">These links contain a secret token and work without signing in. Anyone with the link can download this project.</div>
				{#if data.canEdit}<form method="POST" action="?/rotate" use:enhance onsubmit={(e) => { if (!confirm('Create a new link? Commands using the current one stop working.')) e.preventDefault(); }}>
					<button class="btn text-xs">{@html icons.restart} New link</button>
				</form>{/if}
			</div>
		</section>

		<section class="flex flex-col gap-3">
			<div class="flex items-center gap-3">
				<h2 class="flex-1 font-semibold">Contents <span class="font-normal text-zinc-400">· {data.files.length} files</span></h2>
				<a class="btn" href="/api/projects/{data.project.id}/export" download>{@html icons.download} Download .zip</a>
			</div>
			<div class="max-h-96 overflow-y-auto rounded-xl border border-zinc-200 bg-white">
				{#each data.files as f}
					<div class="flex items-center gap-3 border-b border-zinc-100 px-3 py-1.5 font-mono text-xs last:border-0">
						<span class="flex-1 truncate text-zinc-700">.spatial/{f.path}</span>
						<span class="text-zinc-400 tabular-nums">{kb(f.size)}</span>
					</div>
				{:else}
					<div class="p-6 text-center text-sm text-zinc-400">This project has no files yet.</div>
				{/each}
			</div>
		</section>
	</main>
</div>
