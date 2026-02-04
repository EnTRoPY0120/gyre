<script lang="ts">
	import { preferences } from '$lib/stores/preferences.svelte';
	import { toYaml, toJson, copyToClipboard } from '$lib/utils/format';
	import { cn } from '$lib/utils';
	import { Check, Copy, FileCode, Download } from 'lucide-svelte';
	import { downloadFile, formatResourceForExport } from '$lib/utils/export';

	let {
		data,
		title = 'Resource Manifest',
		showDownload = true
	}: {
		data: Record<string, unknown>;
		title?: string;
		showDownload?: boolean;
	} = $props();

	let copied = $state(false);

	const formattedCode = $derived(preferences.format === 'yaml' ? toYaml(data) : toJson(data));

	async function handleCopy() {
		const success = await copyToClipboard(formattedCode);
		if (success) {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	function handleDownload() {
		const format = preferences.format;
		const exported = formatResourceForExport(data, format);
		const content = format === 'json' ? exported : toYaml(exported);
		const metadata = data.metadata as { name?: string } | undefined;
		const name = metadata?.name || 'resource';
		downloadFile(
			content,
			`${name}.${format}`,
			format === 'json' ? 'application/json' : 'text/yaml'
		);
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
			e.preventDefault();
			preferences.setFormat('json');
		} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			preferences.setFormat('yaml');
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col overflow-hidden rounded-xl border border-sidebar-border bg-sidebar/30">
	<!-- Toolbar -->
	<div
		class="flex items-center justify-between border-b border-sidebar-border bg-sidebar-accent/20 px-4 py-2"
	>
		<div class="flex items-center gap-2">
			<FileCode class="size-4 text-muted-foreground" />
			<span class="text-xs font-bold text-muted-foreground uppercase">{title}</span>
		</div>

		<div class="flex items-center gap-1.5">
			<!-- Format Toggle -->
			<div class="mr-2 flex rounded-lg bg-sidebar-accent/50 p-0.5">
				<button
					class={cn(
						'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold transition-all',
						preferences.format === 'yaml'
							? 'bg-primary text-primary-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
					onclick={() => preferences.setFormat('yaml')}
				>
					YAML
				</button>
				<button
					class={cn(
						'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold transition-all',
						preferences.format === 'json'
							? 'bg-primary text-primary-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					)}
					onclick={() => preferences.setFormat('json')}
				>
					JSON
				</button>
			</div>

			<!-- Actions -->
			<button
				class="group flex size-8 items-center justify-center rounded-lg transition-all hover:bg-sidebar-accent hover:text-foreground"
				title="Copy to clipboard"
				onclick={handleCopy}
			>
				{#if copied}
					<Check class="size-4 text-emerald-500" />
				{:else}
					<Copy class="size-4 text-muted-foreground group-hover:text-foreground" />
				{/if}
			</button>

			{#if showDownload}
				<button
					class="group flex size-8 items-center justify-center rounded-lg transition-all hover:bg-sidebar-accent hover:text-foreground"
					title="Download manifest"
					onclick={handleDownload}
				>
					<Download class="size-4 text-muted-foreground group-hover:text-foreground" />
				</button>
			{/if}
		</div>
	</div>

	<!-- Code Area -->
	<div class="relative flex-1 overflow-auto bg-slate-950 p-4">
		<pre class="scrollbar-hide font-mono text-sm leading-relaxed text-slate-300"><code
				>{formattedCode}</code
			></pre>
	</div>
</div>

<style>
	/* Hide scrollbar but keep functionality for the code area if requested */
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	pre {
		tab-size: 2;
	}
</style>
